/**
 * Translation system for the Workflow application
 *
 * Supports Spanish (es) and English (en) languages.
 * All UI text should be extracted here for proper i18n support.
 */

export type Language = "es" | "en";

export const translations = {
	en: {
		// Common
		common: {
			back: "Back",
			cancel: "Cancel",
			save: "Save",
			create: "Create",
			edit: "Edit",
			delete: "Delete",
			search: "Search",
			loading: "Loading...",
			required: "Required",
			optional: "Optional",
			submit: "Submit",
			reset: "Reset",
			apply: "Apply",
			close: "Close",
			add: "Add",
			remove: "Remove",
			yes: "Yes",
			no: "No",
			all: "All",
			none: "None",
			actions: "Actions",
			settings: "Settings",
			preview: "Preview",
			details: "Details",
			version: "Version",
			current: "Current",
			status: "Status",
			name: "Name",
			description: "Description",
			type: "Type",
			options: "Options",
			placeholder: "Placeholder",
			label: "Label",
			noResults: "No results found",
			confirm: "Confirm",
			next: "Next",
			previous: "Previous",
			view: "View",
			filter: "Filter",
			export: "Export",
			refresh: "Refresh",
		},

		// App
		app: {
			title: "Workflow Editor",
			subtitle: "Workflow Integration Platform",
		},

		// Theme
		themeLight: "Light",
		themeDark: "Dark",
		themeSystem: "System",
		themeToggle: "Toggle theme",

		// Language
		languageSpanish: "Español",
		languageEnglish: "English",
		languageToggle: "Toggle language",

		// User Menu
		userAccount: "My Account",
		userProfile: "Profile",
		userLogout: "Log Out",
		userBilling: "Billing",
		userNotifications: "Notifications",
		userPreferences: "Preferences",

		// Workflow
		workflow: {
			title: "Workflows",
			subtitle: "Manage and organize your workflows",
			createWorkflow: "Create Workflow",
			searchPlaceholder: "Search workflows...",
			noWorkflowsFound: "No workflows found",
			noWorkflowsFoundDesc: "Create your first workflow to get started",
			tryAdjusting: "Try adjusting your search criteria",
			updated: "Updated",
			viewDetails: "View Details",
			editWorkflow: "Edit Workflow",
			deleteConfirm: "Are you sure you want to delete this workflow?",
		},

		// Status
		status: {
			all: "All",
			published: "Published",
			draft: "Draft",
			archived: "Archived",
			active: "Active",
			inactive: "Inactive",
		},

		// Editor
		editor: {
			nodes: "Nodes",
			edges: "Edges",
			canvas: "Canvas",
			zoom: "Zoom",
			zoomIn: "Zoom In",
			zoomOut: "Zoom Out",
			fitView: "Fit to View",
			undo: "Undo",
			redo: "Redo",
			copy: "Copy",
			paste: "Paste",
			cut: "Cut",
			duplicate: "Duplicate",
			selectAll: "Select All",
			deleteSelected: "Delete Selected",
		},

		// Node Types
		nodeTypes: {
			start: "Start",
			end: "End",
			task: "Task",
			decision: "Decision",
			parallel: "Parallel",
			merge: "Merge",
			delay: "Delay",
			webhook: "Webhook",
			form: "Form",
			email: "Email",
			notification: "Notification",
		},

		// Theme
		theme: {
			title: "Theme",
			light: "Light",
			dark: "Dark",
			system: "System",
		},

		// Language
		language: {
			title: "Language",
			english: "English",
			spanish: "Spanish",
		},

		// User
		user: {
			avatar: "User avatar",
			myAccount: "My Account",
			profile: "Profile",
			preferences: "Preferences",
			logout: "Log Out",
		},

		// Validation
		validation: {
			required: "This field is required",
			invalidEmail: "Please enter a valid email address",
			invalidUrl: "Please enter a valid URL",
			minLength: "Minimum {min} characters required",
			maxLength: "Maximum {max} characters allowed",
		},

		// Errors
		errorGeneric: "An error occurred",
		errorNotFound: "Not found",
		errorUnauthorized: "Unauthorized",
		errorForbidden: "Access denied",
		errorServerError: "Server error",
		errorNetworkError: "Connection error",

		// Success messages
		successSaved: "Saved successfully",
		successDeleted: "Deleted successfully",
		successCreated: "Created successfully",
		successUpdated: "Updated successfully",

		// Forbidden page
		forbiddenTitle: "Access Denied",
		forbiddenMessage:
			"You do not have permission to access this workflow dashboard.",
		forbiddenBack: "Back to home",
	},
	es: {
		// Common
		common: {
			back: "Volver",
			cancel: "Cancelar",
			save: "Guardar",
			create: "Crear",
			edit: "Editar",
			delete: "Eliminar",
			search: "Buscar",
			loading: "Cargando...",
			required: "Requerido",
			optional: "Opcional",
			submit: "Enviar",
			reset: "Restablecer",
			apply: "Aplicar",
			close: "Cerrar",
			add: "Agregar",
			remove: "Eliminar",
			yes: "Sí",
			no: "No",
			all: "Todos",
			none: "Ninguno",
			actions: "Acciones",
			settings: "Configuración",
			preview: "Vista previa",
			details: "Detalles",
			version: "Versión",
			current: "Actual",
			status: "Estado",
			name: "Nombre",
			description: "Descripción",
			type: "Tipo",
			options: "Opciones",
			placeholder: "Marcador de posición",
			label: "Etiqueta",
			noResults: "No se encontraron resultados",
			confirm: "Confirmar",
			next: "Siguiente",
			previous: "Anterior",
			view: "Ver",
			filter: "Filtrar",
			export: "Exportar",
			refresh: "Actualizar",
		},

		// App
		app: {
			title: "Editor de Flujos",
			subtitle: "Plataforma de Integración de Flujos de Trabajo",
		},

		// Theme
		themeLight: "Claro",
		themeDark: "Oscuro",
		themeSystem: "Sistema",
		themeToggle: "Cambiar tema",

		// Language
		languageSpanish: "Español",
		languageEnglish: "English",
		languageToggle: "Cambiar idioma",

		// User Menu
		userAccount: "Mi Cuenta",
		userProfile: "Perfil",
		userLogout: "Cerrar Sesión",
		userBilling: "Facturación",
		userNotifications: "Notificaciones",
		userPreferences: "Preferencias",

		// Workflow
		workflow: {
			title: "Flujos de Trabajo",
			subtitle: "Gestione y organice sus flujos de trabajo",
			createWorkflow: "Crear Flujo",
			searchPlaceholder: "Buscar flujos...",
			noWorkflowsFound: "No se encontraron flujos",
			noWorkflowsFoundDesc: "Cree su primer flujo para comenzar",
			tryAdjusting: "Intente ajustar sus criterios de búsqueda",
			updated: "Actualizado",
			viewDetails: "Ver Detalles",
			editWorkflow: "Editar Flujo",
			deleteConfirm: "¿Está seguro de que desea eliminar este flujo?",
		},

		// Status
		status: {
			all: "Todos",
			published: "Publicado",
			draft: "Borrador",
			archived: "Archivado",
			active: "Activo",
			inactive: "Inactivo",
		},

		// Editor
		editor: {
			nodes: "Nodos",
			edges: "Conexiones",
			canvas: "Lienzo",
			zoom: "Zoom",
			zoomIn: "Acercar",
			zoomOut: "Alejar",
			fitView: "Ajustar Vista",
			undo: "Deshacer",
			redo: "Rehacer",
			copy: "Copiar",
			paste: "Pegar",
			cut: "Cortar",
			duplicate: "Duplicar",
			selectAll: "Seleccionar Todo",
			deleteSelected: "Eliminar Seleccionados",
		},

		// Node Types
		nodeTypes: {
			start: "Inicio",
			end: "Fin",
			task: "Tarea",
			decision: "Decisión",
			parallel: "Paralelo",
			merge: "Unir",
			delay: "Retraso",
			webhook: "Webhook",
			form: "Formulario",
			email: "Correo",
			notification: "Notificación",
		},

		// Theme
		theme: {
			title: "Tema",
			light: "Claro",
			dark: "Oscuro",
			system: "Sistema",
		},

		// Language
		language: {
			title: "Idioma",
			english: "Inglés",
			spanish: "Español",
		},

		// User
		user: {
			avatar: "Avatar de usuario",
			myAccount: "Mi Cuenta",
			profile: "Perfil",
			preferences: "Preferencias",
			logout: "Cerrar Sesión",
		},

		// Validation
		validation: {
			required: "Este campo es obligatorio",
			invalidEmail: "Por favor ingrese una dirección de correo válida",
			invalidUrl: "Por favor ingrese una URL válida",
			minLength: "Se requieren mínimo {min} caracteres",
			maxLength: "Máximo {max} caracteres permitidos",
		},

		// Errors
		errorGeneric: "Ha ocurrido un error",
		errorNotFound: "No encontrado",
		errorUnauthorized: "No autorizado",
		errorForbidden: "Acceso denegado",
		errorServerError: "Error del servidor",
		errorNetworkError: "Error de conexión",

		// Success messages
		successSaved: "Guardado exitosamente",
		successDeleted: "Eliminado exitosamente",
		successCreated: "Creado exitosamente",
		successUpdated: "Actualizado exitosamente",

		// Forbidden page
		forbiddenTitle: "Acceso Denegado",
		forbiddenMessage:
			"No tienes permisos para acceder a este panel de flujos de trabajo.",
		forbiddenBack: "Volver al inicio",
	},
} as const;

export type TranslationKeys = keyof (typeof translations)["es"];

/**
 * Gets the locale string for a language
 */
export function getLocaleForLanguage(lang: Language): string {
	switch (lang) {
		case "es":
			return "es-ES";
		case "en":
			return "en-US";
	}
}

/**
 * Detects the browser language and returns the closest supported language
 */
export function detectBrowserLanguage(): Language {
	if (typeof navigator === "undefined") return "es";

	const browserLang = navigator.language.toLowerCase();

	if (browserLang.startsWith("en")) return "en";
	if (browserLang.startsWith("es")) return "es";

	return "es"; // Default to Spanish
}
