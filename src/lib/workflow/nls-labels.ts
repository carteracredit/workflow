/**
 * NLS label overrides by language.
 * Used to translate field labels and section labels from the catalog
 * (which come in English from proxy-svc) into the user's preferred language.
 */

type Language = "en" | "es";

const sectionLabelOverrides: Record<Language, Record<string, string>> = {
	en: {
		actorType: "Actor Type",
		applicant: "Applicant",
		coapplicantIdentity: "Coapplicant Identity (from form node)",
		matchData: "Match Data",
		loan: "Loan",
		collateral: "Collateral",
		employment: "Employment",
		references: "References",
		seller: "Seller",
		client: "Client",
	},
	es: {
		actorType: "Tipo de Actor",
		applicant: "Solicitante",
		coapplicantIdentity: "Identidad del Cosolicitante (desde nodo formulario)",
		matchData: "Datos de Búsqueda",
		loan: "Préstamo",
		collateral: "Garantía",
		employment: "Empleo",
		references: "Referencias",
		seller: "Vendedor",
		client: "Cliente",
	},
};

const fieldLabelOverrides: Record<Language, Record<string, string>> = {
	en: {
		actorType: "Actor Type",
		pullType: "Pull Type",
		userId: "User ID",
		firstName: "First Name",
		middleName: "Middle Name",
		lastName: "Last Name",
		email: "Email",
		birthDate: "Birth Date",
		phoneNumber: "Phone Number",
		taxIdType: "Tax ID Type",
		taxIdNumber: "SSN/ITIN",
		addressStreetNumber: "Street Number",
		addressStreetName: "Street Name",
		addressApt: "Apt/Suite",
		addressCity: "City",
		addressState: "State",
		addressZipCode: "Zip Code",
		phone: "Phone",
	},
	es: {
		actorType: "Tipo de Actor",
		pullType: "Tipo de Consulta",
		userId: "ID de Usuario",
		firstName: "Nombre",
		middleName: "Segundo Nombre",
		lastName: "Apellido",
		email: "Correo Electrónico",
		birthDate: "Fecha de Nacimiento (AAAA-MM-DD)",
		phoneNumber: "Número de Teléfono",
		taxIdType: "Tipo de ID Fiscal",
		taxIdNumber: "SSN/ITIN",
		addressStreetNumber: "Número de Calle",
		addressStreetName: "Nombre de Calle",
		addressApt: "Apt/Suite",
		addressCity: "Ciudad",
		addressState: "Estado",
		addressZipCode: "Código Postal",
		phone: "Teléfono",
	},
};

const optionLabelOverrides: Record<Language, Record<string, string>> = {
	en: {
		applicant: "Applicant",
		coapplicant: "Coapplicant",
		soft: "Soft",
		hard: "Hard",
		new: "New",
		SSN: "SSN",
		ITIN: "ITIN",
	},
	es: {
		applicant: "Solicitante",
		coapplicant: "Cosolicitante",
		soft: "Suave",
		hard: "Fuerte",
		new: "Nuevo",
		SSN: "SSN",
		ITIN: "ITIN",
	},
};

export function getNlsSectionLabel(
	language: Language,
	sectionId: string,
	fallbackLabel: string,
): string {
	return sectionLabelOverrides[language]?.[sectionId] ?? fallbackLabel;
}

export function getNlsFieldLabel(
	language: Language,
	fieldId: string,
	fallbackLabel: string,
): string {
	return fieldLabelOverrides[language]?.[fieldId] ?? fallbackLabel;
}

export function getNlsOptionLabel(
	language: Language,
	optionValue: string,
	fallbackLabel: string,
): string {
	return optionLabelOverrides[language]?.[optionValue] ?? fallbackLabel;
}

const functionDescriptionOverrides: Record<Language, Record<string, string>> = {
	en: {
		prequalification:
			"Runs the full prequalification pipeline: customer save, credit pull, bureau data, SageMaker scoring, and rule evaluation. Supports applicant (existing user) or coapplicant (inline identity from form).",
		findPrequalificationMatches:
			"Searches for existing prequalification records matching the provided PII fields (SSN/ITIN, phone, email, userId). Returns full snapshots including bureau data and latest run.",
	},
	es: {
		prequalification:
			"Ejecuta el pipeline completo de precalificación: guardado de cliente, consulta de crédito, datos del buró, scoring de SageMaker y evaluación de reglas. Soporta solicitante (usuario existente) o cosolicitante (identidad desde formulario).",
		findPrequalificationMatches:
			"Busca registros de precalificación existentes que coincidan con los campos PII proporcionados (SSN/ITIN, teléfono, email, userId). Devuelve snapshots completos incluyendo datos del buró y último run.",
	},
};

export function getNlsFunctionDescription(
	language: Language,
	functionId: string,
	fallbackDescription: string,
): string {
	return (
		functionDescriptionOverrides[language]?.[functionId] ?? fallbackDescription
	);
}
