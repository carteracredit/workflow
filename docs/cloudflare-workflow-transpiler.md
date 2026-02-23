# Cloudflare Workflow Transpiler - Documento Tecnico

> Especificacion tecnica para la conversion de workflows visuales (JSON de nodos y conexiones) a codigo TypeScript ejecutable en Cloudflare Workflows. Este documento sirve como referencia para desarrolladores humanos y agentes de IA.

---

## 1. Modelo de Ejecucion de Cloudflare Workflows

Cloudflare Workflows es un runtime de ejecucion durable basado en **replay determinista**. El metodo `run()` de un workflow puede re-ejecutarse multiples veces por la infraestructura (rebalanceo, recuperacion de fallos), pero los steps completados retornan su resultado cacheado sin ejecutar el callback.

### 1.1 Primitivas de Step

| Primitiva                                  | Descripcion                                       | Cuenta como step |
| ------------------------------------------ | ------------------------------------------------- | ---------------- |
| `step.do(name, callback)`                  | Ejecuta logica durable. El resultado se persiste. | Si               |
| `step.do(name, config, callback)`          | Igual, con reintentos y timeout configurables.    | Si               |
| `step.waitForEvent(name, {type, timeout})` | Pausa y espera un evento externo.                 | Si               |
| `step.sleep(name, duration)`               | Pausa por tiempo relativo.                        | **No**           |
| `step.sleepUntil(name, date)`              | Pausa hasta fecha absoluta.                       | **No**           |

### 1.2 Reglas Fundamentales

1. **Nombres de step unicos**: Cada `step.do()` o `step.waitForEvent()` debe tener un nombre unico dentro de la ejecucion. Si dos steps comparten nombre, Cloudflare retorna el resultado del primero para ambos.
2. **Replay determinista**: Al re-ejecutarse `run()`, los steps completados retornan su cache instantaneamente. El codigo JavaScript entre steps (if/else, variables, loops) se re-ejecuta normalmente.
3. **Estado serializable**: El valor retornado por un step debe ser JSON-serializable. No se pueden retornar funciones, symbols, ni objetos con referencias circulares.
4. **Control de flujo nativo**: `if`, `else`, `while`, `for`, `try/catch`, `Promise.all` funcionan normalmente entre steps.

### 1.3 Limites (plan Paid)

| Limite                     | Valor          | Nota                                        |
| -------------------------- | -------------- | ------------------------------------------- |
| Steps por instancia        | 1024           | `step.sleep` y `step.sleepUntil` no cuentan |
| Estado por step            | 1 MiB          | Limita tamano de payloads y snapshots       |
| Estado total por instancia | 1 GB           | Acumulado de todos los steps                |
| Timeout de `waitForEvent`  | Hasta 365 dias | Si expira, lanza error (usar try/catch)     |
| Duracion de `step.sleep`   | Hasta 365 dias | No cuenta como step                         |
| Instancias concurrentes    | 10,000         | Solo las `running`, no las `waiting`        |
| Instancias `waiting`       | Sin limite     | Hibernan sin consumir recursos              |

### 1.4 Ciclo de Vida de una Instancia

```
queued -> running -> waiting (sleep/waitForEvent) -> running -> ... -> complete
                                                                   -> errored
                                                                   -> terminated
```

Las instancias en estado `waiting` no consumen slots de concurrencia. Un workflow puede tener millones de instancias esperando eventos simultaneamente.

---

## 2. Tipos de Nodo y Prototipos de Codigo

Cada tipo de nodo del editor visual se traduce a un patron especifico de Cloudflare Workflows.

### Convenciones de Naming

```
Step name (fuera de loop):  {slug}
Step name (dentro de loop): {slug}-attempt-{N}
Event type (fuera de loop): {slug}-{instanceId}
Event type (dentro de loop): {slug}-{instanceId}-attempt-{N}
```

Los slugs son kebab-case unicos derivados del titulo del nodo:

```
"Formulario Inicial" -> formulario-inicial
"Decision 1"         -> decision-1
"API Buro"           -> api-buro
```

En todos los prototipos siguientes, `ctx` se refiere a variables disponibles en el scope:

- `event`: `WorkflowEvent<Params>` con `event.payload`, `event.instanceId`, `event.timestamp`
- `step`: `WorkflowStep` con `step.do()`, `step.waitForEvent()`, `step.sleep()`
- `attempt`: `number` (solo dentro de un loop de retry, 0-indexed)
- `this.env`: bindings de Cloudflare (R2, D1, Durable Objects, etc.)

---

### 2.1 Start

**Rol**: Punto de entrada del workflow. Siempre es el primer nodo. No genera codigo explicito; el inicio del metodo `run()` es implicito.

**Conexiones**: 0 entradas, 1 salida.

**Prototipo**:

```typescript
// El nodo Start no genera codigo.
// El metodo run() ES el punto de inicio.
// Los datos iniciales estan en event.payload.
async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // event.payload contiene los parametros del workflow
    // event.instanceId es el ID unico de esta instancia
    // event.timestamp es cuando se creo la instancia
}
```

---

### 2.2 End

**Rol**: Finaliza el workflow con exito. Retorna un resultado serializable.

**Conexiones**: 1 entrada, 0 salidas (terminal).

**Prototipo**:

```typescript
// Fuera de loop
return { success: true, payload: event.payload };

// Dentro de loop de retry (marca flag de completado y sale del loop)
cp1Done = true;
// El return ocurre despues del while cuando cp1Done = true
```

**Nota**: Si el End esta dentro de una rama de decision que no es la ultima del loop, se usa `return` directo. Si el Join esta despues, se usa `cpDone = true` y el return ocurre fuera del if/else.

---

### 2.3 Reject

**Rol**: Finaliza el workflow con rechazo. Puede tener reintentos habilitados.

**Conexiones**: 1 entrada. Si `allowRetry=false`: 0 salidas (terminal). Si `allowRetry=true`: 1 salida hacia el checkpoint anterior mas proximo.

**Config**:

```typescript
interface RejectConfig {
	allowRetry: boolean;
	maxRetries?: number; // 0 = ilimitados
	retryCount?: number; // runtime counter
}
```

**Prototipo SIN retry (terminal)**:

```typescript
return { success: false, reason: "no-hay-formulario" };
```

**Prototipo CON retry (dentro de un while loop)**:

```typescript
// REJECT con retry - incrementar contador y esperar senal
attempt++;
if (attempt <= maxRetries) {
	await step.do(`notify-reject-attempt-${attempt}`, async () => {
		// Notificar al usuario/sistema del rechazo
		// Broadcast via Durable Object al frontend
		return { rejected: true, nextAttempt: attempt };
	});

	await step.waitForEvent(`retry-checkpoint-1-attempt-${attempt}`, {
		type: `retry-checkpoint-1-${event.instanceId}-attempt-${attempt}`,
		timeout: "48 hours",
	});
}
continue; // Vuelve al inicio del while (checkpoint)
```

**Semantica de retry**: El `continue` reinicia el loop desde el checkpoint. Todos los steps del nuevo intento tienen nombres unicos gracias al suffix `-attempt-{N}`. El frontend envia el evento de retry con el type correcto que incluye el numero de intento.

---

### 2.4 Form

**Rol**: Espera a que un usuario llene un formulario. El workflow se pausa hasta recibir el evento con los datos del formulario.

**Conexiones**: 1 entrada, 1 salida. Requiere al menos 1 rol asignado.

**Config**:

```typescript
interface FormConfig {
	formId: string; // ID del formulario a renderizar
	fields?: string[]; // Campos especificos (opcional)
}
```

**Prototipo fuera de loop**:

```typescript
const formularioInicial = await step.waitForEvent("formulario-inicial", {
	type: `formulario-inicial-${event.instanceId}`,
	timeout: "24 hours",
});
// formularioInicial.payload contiene los datos del formulario
```

**Prototipo dentro de loop de retry**:

```typescript
const formularioRevision = await step.waitForEvent(
	`formulario-revision-attempt-${attempt}`,
	{
		type: `formulario-revision-${event.instanceId}-attempt-${attempt}`,
		timeout: "24 hours",
	},
);
```

**Como se envia el evento desde el backend**:

```typescript
// En workflow-svc (Hono endpoint)
const instance = await env.MY_WORKFLOW.get(instanceId);
await instance.sendEvent({
	type: `formulario-inicial-${instanceId}`,
	payload: { nombre: "Juan", curp: "XXXX" },
});
```

**Soporte para staleTimeout**: Si el nodo tiene `staleTimeout` configurado, el timeout del `waitForEvent` se toma de ahi. Si no, se usa un default (24 hours).

---

### 2.5 Decision

**Rol**: Bifurca el flujo en dos caminos mutuamente exclusivos basados en una condicion.

**Conexiones**: 1 entrada, 2 salidas (puerto `top` = verdadero/verde, puerto `bottom` = falso/rojo).

**Config**:

```typescript
interface DecisionConfig {
	condition: string; // Expresion JavaScript evaluable
}
```

**Prototipo (decision simple)**:

```typescript
// La condicion se evalua con datos de steps anteriores
if (formularioInicial.payload.monto > 10000) {
	// rama TRUE (top/verde)
	// ... nodos de esta rama ...
} else {
	// rama FALSE (bottom/roja)
	// ... nodos de esta rama ...
}
```

**Prototipo (decisions anidadas)**:

Cuando Decision2 es hijo directo de la rama FALSE de Decision1, y ambas convergen en el mismo Join:

```typescript
if (condicion1) {
    // rama TRUE de Decision1
} else {
    // rama FALSE de Decision1 (puede contener nodos secuenciales + sub-decisions)
    // Si hay un nodo secuencial antes de Decision2:
    await step.waitForEvent('formulario-b-attempt-...', { ... });

    if (condicion2) {
        // rama TRUE de Decision2
    } else {
        // rama FALSE de Decision2
    }
}
// JOIN implicito: el codigo continua aqui
```

**Nota sobre condiciones**: La condicion es una expresion JavaScript que referencia variables de steps anteriores. El transpilador debe resolver que variables estan disponibles en el scope. En runtime, las condiciones se evaluan con los datos cacheados de steps previos, por lo que el replay es determinista.

---

### 2.6 Challenge

**Rol**: Espera una accion de aceptacion o firma del usuario. Similar a Form pero con semantica de aprobacion/rechazo y timeout configurable.

**Conexiones**: 1 entrada, 2 salidas (puerto `top` = aceptado/verde, puerto `bottom` = rechazado/rojo). Requiere al menos 1 rol.

**Config**:

```typescript
interface ChallengeConfig {
	challengeType: "acceptance" | "signature";
	challengeTimeout: {
		value: number;
		unit: "seconds" | "minutes" | "hours" | "days";
	};
	deliveryMethod: "none" | "sms" | "email" | "both";
	retries?: {
		maxRetries: number; // 1-5
		roles: Role[];
	};
}
```

**Prototipo fuera de loop**:

```typescript
// Enviar OTP/notificacion si deliveryMethod != 'none'
if (deliveryMethod !== "none") {
	await step.do("enviar-challenge-otp", async () => {
		await this.env.NOTIFICATIONS.send({
			type: deliveryMethod,
			to: event.payload.phone,
		});
	});
}

// Esperar respuesta del challenge
let challengeResult;
try {
	challengeResult = await step.waitForEvent("aceptacion-terminos", {
		type: `aceptacion-terminos-${event.instanceId}`,
		timeout: "5 minutes",
	});
} catch (e) {
	// Timeout: tratar como rechazo
	challengeResult = { payload: { accepted: false, reason: "timeout" } };
}

if (challengeResult.payload.accepted) {
	// rama TRUE (top/verde) - aceptado
} else {
	// rama FALSE (bottom/roja) - rechazado o timeout
}
```

**Prototipo dentro de loop de retry**:

```typescript
let challengeResult;
try {
	challengeResult = await step.waitForEvent(
		`aceptacion-terminos-attempt-${attempt}`,
		{
			type: `aceptacion-terminos-${event.instanceId}-attempt-${attempt}`,
			timeout: "5 minutes",
		},
	);
} catch (e) {
	challengeResult = { payload: { accepted: false, reason: "timeout" } };
}

if (challengeResult.payload.accepted) {
	// aceptado
} else {
	// rechazado
}
```

**Diferencia con Decision**: Decision evalua una condicion con datos existentes (sincrono). Challenge espera input externo (asincrono via `waitForEvent`) y tiene timeout que puede provocar rechazo automatico.

---

### 2.7 API

**Rol**: Ejecuta una llamada HTTP a un servicio externo. Tiene configuracion de reintentos, timeout, y estrategia de fallo.

**Conexiones**: 1 entrada. Si `onFailure='stop'`: 0 salidas (terminal). Si no: 1 salida.

**Config**:

```typescript
interface APIConfig {
	method: "GET" | "POST" | "PUT" | "DELETE";
	url: string;
	failureHandling: {
		onFailure: "stop" | "retry" | "continue" | "return-to-checkpoint";
		maxRetries: number; // 0-2 (reintentos de Cloudflare, no del loop)
		retryCount: number; // runtime
		cacheStrategy:
			| "always-execute"
			| "cache-until-checkpoint-reset"
			| "cache-until-workflow-end";
		timeout: number; // ms (5000-300000)
		checkpointId?: string; // solo si onFailure = 'return-to-checkpoint'
	};
}
```

**Prototipo con `onFailure: 'retry'`** (reintentos nativos de Cloudflare):

```typescript
const apiResult = await step.do(
	`consulta-buro-attempt-${attempt}`,
	{
		retries: {
			limit: 2,
			delay: "5 seconds",
			backoff: "exponential",
		},
		timeout: "30 seconds",
	},
	async () => {
		const response = await fetch("https://api.buro.com/check", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(event.payload),
		});
		if (!response.ok) {
			throw new Error(`API failed: ${response.status}`);
		}
		return response.json();
	},
);
```

**Prototipo con `onFailure: 'stop'`** (terminal, no genera salida):

```typescript
import { NonRetryableError } from "cloudflare:workflows";

await step.do("verificacion-critica", async () => {
	const response = await fetch("https://api.critica.com/verify", {
		method: "POST",
		body: JSON.stringify(event.payload),
	});
	if (!response.ok) {
		throw new NonRetryableError(`Verificacion fallida: ${response.status}`);
	}
	return response.json();
});
// Si llega aqui, el workflow termina
return { success: false, reason: "api-stop" };
```

**Prototipo con `onFailure: 'continue'`**:

```typescript
let apiResult;
try {
	apiResult = await step.do(
		`api-opcional-attempt-${attempt}`,
		{ retries: { limit: 1, delay: "2 seconds", backoff: "constant" } },
		async () => {
			const response = await fetch("https://api.opcional.com/data");
			if (!response.ok) throw new Error("Failed");
			return response.json();
		},
	);
} catch (e) {
	// Continuar sin resultado de API
	apiResult = { fallback: true };
}
```

**Prototipo con `onFailure: 'return-to-checkpoint'`**:

Funciona igual que Reject con retry: incrementa el contador de attempt y hace `continue` en el while loop del checkpoint apuntado.

```typescript
try {
	const apiResult = await step.do(
		`api-externa-attempt-${attempt}`,
		{ retries: { limit: 0 }, timeout: "30 seconds" },
		async () => {
			const response = await fetch("https://api.externa.com/process");
			if (!response.ok) throw new Error(`API failed: ${response.status}`);
			return response.json();
		},
	);
} catch (e) {
	// Fallo de API -> volver al checkpoint (mismo patron que Reject)
	attempt++;
	if (attempt <= maxRetries) {
		await step.waitForEvent(`retry-checkpoint-1-attempt-${attempt}`, {
			type: `retry-checkpoint-1-${event.instanceId}-attempt-${attempt}`,
			timeout: "48 hours",
		});
	}
	continue; // Vuelve al inicio del while (checkpoint)
}
```

**Sobre cacheStrategy**: Este campo define si el resultado de la API debe re-ejecutarse o usar cache. El transpilador lo implementa asi:

- `always-execute`: Nombre de step unico por attempt (default, siempre se re-ejecuta en retry)
- `cache-until-checkpoint-reset`: Nombre de step fijo (sin attempt suffix). En retry, Cloudflare retorna el resultado cacheado del primer intento.
- `cache-until-workflow-end`: Igual que el anterior, pero el cache persiste incluso si pasa por multiples checkpoints.

---

### 2.8 Transform

**Rol**: Ejecuta logica de transformacion de datos. No espera input externo.

**Conexiones**: 1 entrada, 1 salida.

**Config**:

```typescript
interface TransformConfig {
	code: string; // Codigo TypeScript a ejecutar
}
```

**Prototipo fuera de loop**:

```typescript
const datosTransformados = await step.do("transformar-datos", async () => {
	// El codigo del campo config.code se inserta aqui
	const input = formularioInicial.payload;
	return {
		nombreCompleto: `${input.nombre} ${input.apellido}`,
		montoFormateado: new Intl.NumberFormat("es-MX").format(input.monto),
	};
});
```

**Prototipo dentro de loop de retry**:

```typescript
const datosTransformados = await step.do(
	`transformar-datos-attempt-${attempt}`,
	async () => {
		// Transformacion con datos del intento actual
		return { processed: true, attempt };
	},
);
```

---

### 2.9 Message

**Rol**: Envia una notificacion (email, SMS). No espera respuesta.

**Conexiones**: 1 entrada, 1 salida.

**Config**:

```typescript
interface MessageConfig {
	channel: "email" | "sms";
	template: string;
}
```

**Prototipo fuera de loop**:

```typescript
await step.do("notificar-aprobacion", async () => {
	await this.env.NOTIFICATIONS.send({
		channel: "email",
		template: "aprobacion-credito",
		to: event.payload.email,
		data: { nombre: event.payload.nombre },
	});
});
```

**Prototipo dentro de loop de retry**:

```typescript
await step.do(`notificar-rechazo-attempt-${attempt}`, async () => {
	await this.env.NOTIFICATIONS.send({
		channel: "sms",
		template: "rechazo-solicitud",
		to: event.payload.phone,
		data: { intento: attempt },
	});
});
```

---

### 2.10 Checkpoint

**Rol**: Marca un punto de control en el flujo. Los nodos Reject y API con `return-to-checkpoint` pueden apuntar aqui para reintentar.

**Conexiones**: 1 entrada normal (+ conexiones de reintento que no cuentan para el limite), 1 salida.

**Tipos**: `normal` | `safe`

**Config**:

```typescript
interface CheckpointConfig {
	checkpointName?: string;
	notes?: string;
}
```

#### 2.10.1 Checkpoint Normal

Semantica: punto de retorno. Todo lo que sigue puede re-ejecutarse en cada intento.

**Prototipo** (genera el inicio de un `while` loop):

```typescript
// --- CHECKPOINT: verificacion-inicial ---
let cpVerificacionAttempt = 0;
const cpVerificacionMax = 3; // viene del Reject.config.maxRetries
let cpVerificacionDone = false;

while (cpVerificacionAttempt <= cpVerificacionMax && !cpVerificacionDone) {
	await step.do(
		`checkpoint-verificacion-inicial-marker-attempt-${cpVerificacionAttempt}`,
		async () => {
			// Snapshot del estado al entrar al checkpoint
			await this.env.R2.put(
				`cases/${event.instanceId}/checkpoint-verificacion-inicial-attempt-${cpVerificacionAttempt}.json`,
				JSON.stringify({
					checkpoint: "verificacion-inicial",
					attempt: cpVerificacionAttempt,
					timestamp: Date.now(),
				}),
			);
			return {
				checkpoint: "verificacion-inicial",
				attempt: cpVerificacionAttempt,
			};
		},
	);

	// ... nodos post-checkpoint van aqui ...
	// ... si Reject: attempt++ -> continue ...
	// ... si exito: cpVerificacionDone = true ...
}

if (!cpVerificacionDone) {
	return { success: false, reason: "max-retries-verificacion-inicial" };
}
```

#### 2.10.2 Checkpoint Safe

Semantica: punto de congelacion. Todo lo anterior es inmutable. El safe checkpoint genera un snapshot en R2 que actua como fuente de verdad inmutable. El loop de retry solo afecta lo que viene despues.

**Prototipo** (genera snapshot inmutable + inicio de `while` loop):

```typescript
// --- SAFE CHECKPOINT: datos-verificados ---
// Congelar estado: todo lo anterior es inmutable a partir de aqui
const snapshotDatosVerificados = await step.do(
	"checkpoint-datos-verificados-freeze",
	async () => {
		const frozen = {
			formData: formularioInicial.payload,
			scoreBuro: scoreBuro,
			frozenAt: Date.now(),
		};
		await this.env.R2.put(
			`cases/${event.instanceId}/checkpoint-datos-verificados-frozen.json`,
			JSON.stringify(frozen),
		);
		return frozen;
	},
);

// Loop de retry (solo lo posterior al safe checkpoint)
let cpDatosVerificadosAttempt = 0;
const cpDatosVerificadosMax = 3;
let cpDatosVerificadosDone = false;

while (
	cpDatosVerificadosAttempt <= cpDatosVerificadosMax &&
	!cpDatosVerificadosDone
) {
	await step.do(
		`checkpoint-datos-verificados-marker-attempt-${cpDatosVerificadosAttempt}`,
		async () => {
			return {
				checkpoint: "datos-verificados",
				attempt: cpDatosVerificadosAttempt,
			};
		},
	);

	// ... nodos post-checkpoint usan snapshotDatosVerificados ...
	// Los datos del snapshot son inmutables (vienen de un step cacheado)
}
```

**Diferencia clave Normal vs Safe en el transpilador**:

| Aspecto                          | Normal                                               | Safe                                |
| -------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Steps pre-checkpoint             | Pueden tener suffix `-attempt-N` si hay loop externo | NUNCA tienen suffix (nombres fijos) |
| Snapshot en R2                   | Opcional (para trazabilidad)                         | Obligatorio (inmutabilidad)         |
| Re-ejecucion de steps anteriores | Posible si hay checkpoint externo                    | Imposible por diseno                |

---

### 2.11 Join

**Rol**: Punto de convergencia donde multiples ramas exclusivas se unen para continuar el flujo. No genera un step de Cloudflare; es puramente estructural.

**Conexiones**: Multiples entradas (sin limite), 1 salida.

**Prototipo**:

```typescript
// El Join NO genera codigo.
// Es el punto donde el bloque if/else termina
// y el codigo continua de forma lineal.

if (condicion1) {
	// rama 1
} else if (condicion2) {
	// rama 2
} else {
	// rama 3
}
// <-- AQUI ES EL JOIN (implicito)
// El codigo continua linealmente desde aqui
```

**Dentro de loop de retry**: El Join sigue siendo implicito. Si una rama hace `return` o `continue`, el Join solo se alcanza por las ramas que "caen" al final del if/else.

**Nota para el transpilador**: El Join es el "post-dominator" de las ramas de Decision/Challenge. El codigo del Join y todo lo posterior debe generarse FUERA de los bloques condicionales.

---

### 2.12 FlagChange

**Rol**: Modifica flags (banderas de estado) del workflow. Los flags son metadatos visibles en el frontend para indicar estado del caso.

**Conexiones**: 1 entrada, 1 salida.

**Config**:

```typescript
interface FlagChangeConfig {
	flagChanges: Array<{
		flagId: string;
		optionId: string;
	}>;
}
```

**Prototipo fuera de loop**:

```typescript
await step.do("cambiar-estado-aprobacion", async () => {
	// Actualizar flags en la base de datos del caso
	await this.env.DB.prepare(
		"UPDATE case_flags SET option_id = ? WHERE case_id = ? AND flag_id = ?",
	)
		.bind("option-aprobado", event.instanceId, "flag-estado-aprobacion")
		.run();

	// Broadcast via Durable Object para actualizar frontend en tiempo real
	const caseRoom = this.env.CASE_ROOMS.get(
		this.env.CASE_ROOMS.idFromName(event.instanceId),
	);
	await caseRoom.fetch(
		new Request("https://internal/broadcast", {
			method: "POST",
			body: JSON.stringify({
				type: "flag-changed",
				flagId: "flag-estado-aprobacion",
				optionId: "option-aprobado",
			}),
		}),
	);
});
```

**Prototipo dentro de loop de retry**:

```typescript
await step.do(`cambiar-estado-en-revision-attempt-${attempt}`, async () => {
	await this.env.DB.prepare(
		"UPDATE case_flags SET option_id = ? WHERE case_id = ? AND flag_id = ?",
	)
		.bind("option-en-revision", event.instanceId, "flag-estado")
		.run();
});
```

---

## 3. Patrones de Composicion

### 3.1 Decision Simple con Join (2 ramas)

```
Start -> Decision -> (TRUE)  FormA -> Join -> End
                  -> (FALSE) FormB -> Join
```

```typescript
async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    if (event.payload.tipoCliente === 'premium') {
        await step.waitForEvent('formulario-a', {
            type: `formulario-a-${event.instanceId}`,
            timeout: '24 hours'
        });
    } else {
        await step.waitForEvent('formulario-b', {
            type: `formulario-b-${event.instanceId}`,
            timeout: '24 hours'
        });
    }
    // JOIN implicito
    return { success: true };
}
```

### 3.2 Decisions Anidadas con Join (3+ ramas)

```
Start -> D1 -> (TRUE)  FormA ---------> Join -> End
            -> (FALSE) D2 -> (TRUE)  FormB -> Join
                           -> (FALSE) FormC -> Join
```

```typescript
async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    if (condicion1) {
        await step.waitForEvent('formulario-a', {
            type: `formulario-a-${event.instanceId}`,
            timeout: '24 hours'
        });
    } else if (condicion2) {
        await step.waitForEvent('formulario-b', {
            type: `formulario-b-${event.instanceId}`,
            timeout: '24 hours'
        });
    } else {
        await step.waitForEvent('formulario-c', {
            type: `formulario-c-${event.instanceId}`,
            timeout: '24 hours'
        });
    }
    // JOIN implicito
    return { success: true };
}
```

### 3.3 Nodos Secuenciales dentro de Rama + Sub-Decision

```
Start -> D1 -> (TRUE)  FormA -----------------------> Join -> End
            -> (FALSE) FormB -> D2 -> (TRUE)  FormC -> Join
                                   -> (FALSE) FormD -> Join
```

FormB es secuencial (no bifurcado): siempre se ejecuta si D1=FALSE.

```typescript
async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    if (condicion1) {
        await step.waitForEvent('formulario-a', {
            type: `formulario-a-${event.instanceId}`,
            timeout: '24 hours'
        });
    } else {
        // FormB: secuencial, siempre se ejecuta en rama FALSE
        await step.waitForEvent('formulario-b', {
            type: `formulario-b-${event.instanceId}`,
            timeout: '24 hours'
        });

        // D2: sub-decision dentro de la rama
        if (condicion2) {
            await step.waitForEvent('formulario-c', {
                type: `formulario-c-${event.instanceId}`,
                timeout: '24 hours'
            });
        } else {
            await step.waitForEvent('formulario-d', {
                type: `formulario-d-${event.instanceId}`,
                timeout: '24 hours'
            });
        }
    }
    // JOIN implicito
    return { success: true };
}
```

### 3.4 Checkpoint con Reject y Retry

```
Start -> FormInicial -> CP1 -> D1 -> (TRUE)  FormA -> Join -> End
                         ^      -> (FALSE) D2 -> (TRUE)  FormB -> Join
                         |                    -> (FALSE) Reject(retry=3) -+
                         +-----------------------------------------------+
```

```typescript
async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // PRE-CHECKPOINT (ejecuta una sola vez)
    const formularioInicial = await step.waitForEvent('formulario-inicial', {
        type: `formulario-inicial-${event.instanceId}`,
        timeout: '24 hours'
    });

    // CHECKPOINT 1 (loop de retry)
    let cp1Attempt = 0;
    const cp1Max = 3;
    let cp1Done = false;

    while (cp1Attempt <= cp1Max && !cp1Done) {
        await step.do(`checkpoint-1-marker-attempt-${cp1Attempt}`, async () => {
            return { checkpoint: 'checkpoint-1', attempt: cp1Attempt };
        });

        const elegibilidad = await step.do(
            `check-elegibilidad-attempt-${cp1Attempt}`,
            async () => {
                return await this.checkEligibility(formularioInicial.payload);
            }
        );

        if (elegibilidad.tipoA) {
            await step.waitForEvent(`formulario-a-attempt-${cp1Attempt}`, {
                type: `formulario-a-${event.instanceId}-attempt-${cp1Attempt}`,
                timeout: '24 hours'
            });
            cp1Done = true;
        } else if (elegibilidad.tipoB) {
            await step.waitForEvent(`formulario-b-attempt-${cp1Attempt}`, {
                type: `formulario-b-${event.instanceId}-attempt-${cp1Attempt}`,
                timeout: '24 hours'
            });
            cp1Done = true;
        } else {
            // REJECT con retry
            cp1Attempt++;
            if (cp1Attempt <= cp1Max) {
                await step.do(`notify-reject-attempt-${cp1Attempt}`, async () => {
                    return { rejected: true, nextAttempt: cp1Attempt };
                });
                await step.waitForEvent(`retry-cp1-attempt-${cp1Attempt}`, {
                    type: `retry-cp1-${event.instanceId}-attempt-${cp1Attempt}`,
                    timeout: '48 hours'
                });
            }
            continue;
        }
    }

    if (!cp1Done) {
        return { success: false, reason: 'max-retries-cp1' };
    }

    // JOIN implicito -> End
    return { success: true };
}
```

### 3.5 Checkpoints Secuenciales (flat, no anidados)

```
Start -> FormInicial -> CP1(safe) -> [zona1] -> Join -> CP2 -> [zona2] -> Join -> End
```

```typescript
async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // === SEGMENTO 0: Pre-CP1 (inmutable) ===
    const formularioInicial = await step.waitForEvent('formulario-inicial', {
        type: `formulario-inicial-${event.instanceId}`,
        timeout: '24 hours'
    });

    // === CP1 SAFE: Congelar estado ===
    const snapshot = await step.do('checkpoint-1-safe-freeze', async () => {
        const frozen = { formData: formularioInicial.payload, frozenAt: Date.now() };
        await this.env.R2.put(
            `cases/${event.instanceId}/cp1-frozen.json`,
            JSON.stringify(frozen)
        );
        return frozen;
    });

    // === CP1 LOOP ===
    let cp1Attempt = 0;
    const cp1Max = 3;
    let cp1Done = false;

    while (cp1Attempt <= cp1Max && !cp1Done) {
        await step.do(`cp1-marker-attempt-${cp1Attempt}`, async () => {
            return { checkpoint: 'cp1', attempt: cp1Attempt };
        });

        // ... zona de branching 1 ...
        // Si exito: cp1Done = true
        // Si reject: cp1Attempt++ -> continue
    }

    if (!cp1Done) {
        return { success: false, reason: 'max-retries-cp1' };
    }

    // === SEGMENTO 1: Entre CP1 y CP2 (lineal) ===
    await step.do('transformar-datos-intermedios', async () => {
        return { processed: true };
    });

    // === CP2 LOOP (flat, independiente de CP1) ===
    let cp2Attempt = 0;
    const cp2Max = 2;
    let cp2Done = false;

    while (cp2Attempt <= cp2Max && !cp2Done) {
        await step.do(`cp2-marker-attempt-${cp2Attempt}`, async () => {
            return { checkpoint: 'cp2', attempt: cp2Attempt };
        });

        // ... zona de branching 2 ...
        // Si exito: cp2Done = true
        // Si reject: cp2Attempt++ -> continue
    }

    if (!cp2Done) {
        return { success: false, reason: 'max-retries-cp2' };
    }

    // === END ===
    return { success: true };
}
```

---

## 4. Reglas de Checkpoints

### 4.1 Checkpoints no viven dentro de decisiones

Un checkpoint solo puede existir en el flujo lineal (trunk). No puede estar dentro de una rama de Decision o Challenge.

```
VALIDO:   Start -> CP1 -> Decision -> FormA -> Join -> CP2 -> End
INVALIDO: Start -> Decision -> (TRUE) -> CP1 -> FormA -> ...
```

### 4.2 Checkpoints no son anidables

No puede haber un checkpoint dentro del scope de retry de otro checkpoint.

```
VALIDO:   Start -> CP1 -> [zona] -> Join -> CP2 -> [zona] -> Join -> End
INVALIDO: Start -> CP1 -> [zona que contiene CP2 dentro] -> ...
```

### 4.3 Antes de un checkpoint, todas las ramas deben estar unidas

Un checkpoint solo puede recibir una conexion de entrada (lineal). Si hay decisiones antes, un Join debe cerrarlas primero.

```
VALIDO:   Start -> Decision -> FormA -> Join -> CP1 -> ...
                            -> FormB -> Join
INVALIDO: Start -> Decision -> FormA -> CP1 -> ...
                            -> FormB -> CP1
```

### 4.4 Reject solo apunta al checkpoint anterior mas proximo

Un Reject con `allowRetry=true` solo puede conectarse al checkpoint inmediatamente anterior en el flujo. No puede saltar a un checkpoint mas lejano. Lo mismo para API con `onFailure=return-to-checkpoint`.

### 4.5 Implicacion: Loops siempre flat

Estas cuatro reglas garantizan que los loops de retry son siempre planos (flat), nunca anidados. La topologia del workflow siempre es:

```
[Segmento Lineal 0]
  -> [Checkpoint 1] -> while loop
    -> [Zona de Branching con decisions + joins internos]
  -> [Join]
[Segmento Lineal 1]
  -> [Checkpoint 2] -> while loop
    -> [Zona de Branching con decisions + joins internos]
  -> [Join]
[Segmento Lineal N]
  -> End
```

---

## 5. Estrategia de Event Types (Opcion B)

Todos los `waitForEvent` dentro de loops de retry usan event types unicos por intento. Esto elimina el riesgo de eventos fantasma (un evento de attempt-0 consumido accidentalmente por attempt-1).

### 5.1 Patron de Naming

| Contexto       | Step name                    | Event type                                |
| -------------- | ---------------------------- | ----------------------------------------- |
| Fuera de loop  | `{slug}`                     | `{slug}-{instanceId}`                     |
| Dentro de loop | `{slug}-attempt-{N}`         | `{slug}-{instanceId}-attempt-{N}`         |
| Retry signal   | `retry-{cpSlug}-attempt-{N}` | `retry-{cpSlug}-{instanceId}-attempt-{N}` |

### 5.2 Como el Frontend Envia Eventos

El workflow-svc debe exponer el intento actual para que el frontend construya el event type correcto:

```typescript
// 1. Frontend consulta estado del caso
// GET /api/cases/:caseId/status
// Response: { currentStep: "formulario-a", attempt: 1, waiting: true }

// 2. Frontend envia evento con type correcto
// POST /api/cases/:caseId/events
// Body: {
//   type: "formulario-a-<instanceId>-attempt-1",
//   payload: { nombre: "Juan", monto: 50000 }
// }

// 3. workflow-svc reenvia a Cloudflare
const instance = await env.MY_WORKFLOW.get(instanceId);
await instance.sendEvent({
	type: `formulario-a-${instanceId}-attempt-1`,
	payload: { nombre: "Juan", monto: 50000 },
});
```

### 5.3 Validacion de Event Types en Cloudflare

Los event types solo aceptan el patron `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$` (maximo 100 caracteres). Esto significa:

- Guiones (`-`) son validos
- Puntos (`.`) **no** son validos
- El primer caracter debe ser alfanumerico o underscore

---

## 6. Algoritmo del Transpilador

### 6.1 Entrada

```typescript
interface TranspilerInput {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	metadata: WorkflowMetadata;
	flags: Flag[];
}
```

### 6.2 Pasos del Algoritmo

```
1. PARSEAR el grafo (nodos + edges)

2. GENERAR SLUGS unicos kebab-case por nodo
   - Convertir titulo a minusculas
   - Reemplazar espacios y caracteres especiales por guiones
   - Eliminar guiones consecutivos
   - Si hay duplicados, agregar sufijo numerico: formulario-a, formulario-a-2

3. SEGMENTAR el flujo entre checkpoints
   - Recorrer el grafo desde Start siguiendo el trunk lineal
   - Cada checkpoint marca el inicio de un nuevo segmento
   - Cada segmento puede contener decisiones internas con joins
   - Resultado: lista ordenada de segmentos

4. Para cada SEGMENTO:
   a. Si tiene checkpoint con Reject/API apuntandole:
      -> Determinar maxRetries del Reject que apunta a este checkpoint
      -> Generar while loop con attempt counter
      -> Todos los steps usan suffix -attempt-${attempt}
      -> Todos los event types usan suffix -${instanceId}-attempt-${attempt}
   b. Si no tiene checkpoint/retry:
      -> Generar codigo lineal con nombres fijos (sin suffix)

5. Para cada ZONA DE BRANCHING dentro de un segmento:
   a. Encontrar el post-dominator (Join node) usando el grafo
   b. Generar if/else con ramas
   c. Si una rama tiene nodos secuenciales antes de sub-decisions,
      generar codigo secuencial dentro de la rama
   d. Generar codigo del Join FUERA del if/else
   e. Detectar si Decision2 es hijo directo de rama FALSE de Decision1
      y ambas convergen en el mismo Join -> generar else-if

6. GENERAR METADATA:
   - Lista de event types que el workflow espera por segmento
   - Mapa de checkpoints con sus maxRetries
   - Mapa de slugs a node IDs
   - Flags del workflow con sus opciones
```

### 6.3 Estructura del Codigo Generado

```typescript
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';

interface Env {
    R2: R2Bucket;
    DB: D1Database;
    NOTIFICATIONS: Fetcher;
    CASE_ROOMS: DurableObjectNamespace;
}

interface WorkflowParams {
    caseId: string;
    userId: string;
    organizationId: string;
}

/**
 * {metadata.name}
 * Version: {metadata.version}
 * Generated: {timestamp}
 */
export class {ClassName} extends WorkflowEntrypoint<Env, WorkflowParams> {
    async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
        // --- SEGMENTO 0 (pre-checkpoint, lineal) ---
        // steps con nombres fijos

        // --- CHECKPOINT 1 (safe/normal) ---
        // if safe: snapshot inmutable a R2
        // while loop con attempt counter

        // --- SEGMENTO 1 (post-CP1, lineal) ---

        // --- CHECKPOINT 2 ---
        // while loop independiente

        // --- END ---
        return { success: true };
    }
}
```

---

## 7. Replay y Determinismo

### 7.1 Como Funciona el Replay

Cuando la infraestructura de Cloudflare reinicia un Worker que estaba ejecutando un workflow:

1. El metodo `run()` se llama de nuevo desde el inicio
2. Cada `step.do()` o `step.waitForEvent()` que ya se completo retorna su resultado cacheado instantaneamente
3. El codigo JavaScript entre steps (if/else, while, variables) se re-ejecuta normalmente
4. El flujo avanza hasta el primer step no completado y ahi se pausa

### 7.2 Por que el Loop Funciona en Replay

```typescript
let attempt = 0;
while (attempt <= 3) {
    await step.do(`cp-attempt-${attempt}`, ...);     // CACHE si ya completado
    const result = await step.do(`eval-attempt-${attempt}`, ...); // CACHE
    if (result.ok) break;
    attempt++;
    await step.waitForEvent(`retry-attempt-${attempt}`, ...); // CACHE
}
```

En replay tras reinicio en attempt=2:

1. `cp-attempt-0` -> CACHE (instantaneo)
2. `eval-attempt-0` -> CACHE -> `{ok: false}`
3. `attempt = 1`
4. `retry-attempt-1` -> CACHE (instantaneo)
5. `cp-attempt-1` -> CACHE (instantaneo)
6. `eval-attempt-1` -> CACHE -> `{ok: false}`
7. `attempt = 2`
8. `retry-attempt-2` -> CACHE (instantaneo)
9. `cp-attempt-2` -> CACHE (instantaneo)
10. `eval-attempt-2` -> **NO CACHE** -> ejecuta de verdad -> reanuda aqui

El replay reproduce exactamente el mismo camino porque las condiciones se evaluan con los mismos datos cacheados.

### 7.3 Regla Critica: Nombres Unicos

Si dos steps comparten nombre, el segundo retorna el resultado del primero. Esto romperia el loop:

```typescript
// MAL: mismo nombre en cada iteracion
while (attempt <= 3) {
    await step.do('checkpoint', ...); // attempt 1 retorna cache de attempt 0!
}

// BIEN: nombre unico por iteracion
while (attempt <= 3) {
    await step.do(`checkpoint-attempt-${attempt}`, ...);
}
```

---

## 8. Conteo de Steps y Limites

### 8.1 Formula de Conteo

```
steps_totales = steps_pre_checkpoint
              + SUM(steps_por_checkpoint_i * (intentos_fallidos_i + 1))
```

### 8.2 Ejemplo Practico

Workflow con 1 formulario inicial + 1 checkpoint + decision + 2 formularios + reject(maxRetries=3):

| Componente                                  | Steps por ejecucion |
| ------------------------------------------- | ------------------- |
| formulario-inicial (waitForEvent)           | 1                   |
| checkpoint-marker (step.do)                 | 1                   |
| check-elegibilidad (step.do)                | 1                   |
| formulario-a o formulario-b (waitForEvent)  | 1                   |
| notify-reject (step.do) - solo en fallo     | 1                   |
| retry-signal (waitForEvent) - solo en fallo | 1                   |

**Peor caso (3 fallos + 1 exito)**: 1 + (3 \* 4) + 3 = **16 steps** de 1024 disponibles.

### 8.3 Recomendacion

Para workflows con multiples checkpoints, calcular el peor caso de steps:

```
MAX_STEPS = SUM(pre_cp_steps) + SUM(cp_steps * (maxRetries + 1))
```

Si `MAX_STEPS > 800`, considerar reducir maxRetries o simplificar pasos por checkpoint.

---

## 9. Glosario

| Termino               | Definicion                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| **Step**              | Unidad durable de ejecucion en Cloudflare. Su resultado se persiste y se cachea en replay.       |
| **Replay**            | Re-ejecucion del metodo `run()` por la infraestructura. Steps completados retornan cache.        |
| **Slug**              | Identificador kebab-case unico derivado del titulo del nodo. Base para step names y event types. |
| **Attempt**           | Numero de intento dentro de un loop de retry (0-indexed).                                        |
| **Trunk**             | Flujo lineal principal del workflow (fuera de ramas de decision).                                |
| **Post-dominator**    | Nodo Join donde convergen todas las ramas de una decision.                                       |
| **Safe Checkpoint**   | Checkpoint que congela el estado anterior como inmutable.                                        |
| **Event Type**        | Identificador que conecta un `sendEvent()` con el `waitForEvent()` correspondiente.              |
| **Zona de Branching** | Seccion del flujo entre un Decision y su Join correspondiente.                                   |
| **Segmento**          | Seccion del flujo entre dos checkpoints (o inicio/fin).                                          |
