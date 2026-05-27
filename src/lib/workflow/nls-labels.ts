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
		comment: "Comment",
		contact: "Contact",
		identity: "Identity",
		name: "Name",
		address: "Address",
		loanFilter: "Loan Filter",
		contactFilter: "Contact Filter",
		pagination: "Pagination",
		params: "Amortization Parameters",
		options: "Options",
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
		comment: "Comentario",
		contact: "Contacto",
		identity: "Identidad",
		name: "Nombre",
		address: "Dirección",
		loanFilter: "Filtro de Préstamo",
		contactFilter: "Filtro de Contacto",
		pagination: "Paginación",
		params: "Parámetros de Amortización",
		options: "Opciones",
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
		// Search / pagination fields
		Cifno: "CIF No (internal)",
		Cifnumber: "CIF Number",
		Tin: "TIN / SSN / ITIN",
		Tin_Hash: "TIN Hash",
		Email: "Email",
		Phone_Number: "Phone Number",
		Firstname1: "First Name",
		Lastname1: "Last Name",
		Fullname1: "Full Name",
		Dob: "Date of Birth (YYYYMMDD)",
		City: "City",
		State: "State",
		Zip: "Zip Code",
		Loan_Number: "Loan Number",
		Shortname: "Short Name",
		Status_Code_No: "Status Code No",
		Closed_Date: "Closed Date",
		limit: "Max Results",
		afterid: "After ID (cursor)",
		order: "Order",
		orderBy: "Order By",
		afterOrderBy: "After Order By (cursor value)",
		// New function fields
		includeRelatedLoans: "Include Related Loans",
		includeIndirectRelationships: "Include Indirect Relationships",
		runThruDate: "Run Through Date (YYYYMMDD)",
		amortType: "Amortization Type",
		startDate: "Start Date (YYYYMMDD)",
		period: "Period",
		advanceValue: "Advance Value",
		numberOfPeriods: "Number of Periods",
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
		// Search / pagination fields
		Cifno: "No. CIF (interno)",
		Cifnumber: "Número CIF",
		Tin: "TIN / SSN / ITIN",
		Tin_Hash: "Hash TIN",
		Email: "Correo Electrónico",
		Phone_Number: "Número de Teléfono",
		Firstname1: "Nombre",
		Lastname1: "Apellido",
		Fullname1: "Nombre Completo",
		Dob: "Fecha de Nacimiento (AAAAMMDD)",
		City: "Ciudad",
		State: "Estado",
		Zip: "Código Postal",
		Loan_Number: "Número de Préstamo",
		Shortname: "Nombre Corto",
		Status_Code_No: "No. Código de Estatus",
		Closed_Date: "Fecha de Cierre",
		limit: "Máx. Resultados",
		afterid: "Después del ID (cursor)",
		order: "Orden",
		orderBy: "Ordenar por",
		afterOrderBy: "Después de Ordenar por (valor cursor)",
		// New function fields
		includeRelatedLoans: "Incluir Préstamos Relacionados",
		includeIndirectRelationships: "Incluir Relaciones Indirectas",
		runThruDate: "Fecha Hasta (AAAAMMDD)",
		amortType: "Tipo de Amortización",
		startDate: "Fecha de Inicio (AAAAMMDD)",
		period: "Período",
		advanceValue: "Valor de Avance",
		numberOfPeriods: "Número de Períodos",
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
		asc: "Ascending",
		desc: "Descending",
		DA: "Daily (DA)",
		WE: "Weekly (WE)",
		BW: "Bi-weekly (BW)",
		SM: "Semi-monthly (SM)",
		S4: "Semi-monthly 4 (S4)",
		"28": "28-day (28)",
		MO: "Monthly (MO)",
		BM: "Bi-monthly (BM)",
		QU: "Quarterly (QU)",
		SA: "Semi-annual (SA)",
		AN: "Annual (AN)",
	},
	es: {
		applicant: "Solicitante",
		coapplicant: "Cosolicitante",
		soft: "Suave",
		hard: "Fuerte",
		new: "Nuevo",
		SSN: "SSN",
		ITIN: "ITIN",
		asc: "Ascendente",
		desc: "Descendente",
		DA: "Diario (DA)",
		WE: "Semanal (WE)",
		BW: "Quincenal (BW)",
		SM: "Catorcenal (SM)",
		S4: "Catorcenal 4 (S4)",
		"28": "28 días (28)",
		MO: "Mensual (MO)",
		BM: "Bimestral (BM)",
		QU: "Trimestral (QU)",
		SA: "Semestral (SA)",
		AN: "Anual (AN)",
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

const functionLabelOverrides: Record<Language, Record<string, string>> = {
	en: {
		createLoan: "Create Loan",
		cancelLoan: "Cancel Loan",
		getAmortization: "Get Amortization",
		prequalification: "Prequalification",
		findPrequalificationMatches: "Find Matches",
		// Loan Reads
		getLoan: "Get Loan",
		getLoanDetail1: "Get Loan Detail 1",
		getPaymentInfo: "Get Payment Info",
		getCollectionFields: "Get Collection Fields",
		getStatuses: "Get Loan Statuses",
		getPaymentHistory: "Get Payment History",
		getPaymentsDue: "Get Payments Due",
		getPayoffAmounts: "Get Payoff Amounts",
		getPayoffDetails: "Get Payoff Details",
		// Collection Comments
		addCollectionComment: "Add Collection Comment",
		updateCollectionComment: "Update Collection Comment",
		// Contacts & Search
		getContact: "Get Contact",
		searchContacts: "Search Contacts",
		searchLoans: "Search Loans",
		// Calculations
		calculateAmortizedPayment: "Calculate Amortized Payment",
		// Nuevas funciones
		getContactLoans: "Get Contact Loans",
		getContactPortfolio: "Get Contact Portfolio",
		getContactEmployments: "Get Contact Employments",
		getLoanTransactions: "Get Loan Transactions",
		getAmortizationSchedule: "Get Amortization Schedule",
		advancePeriod: "Advance Period",
		getLoanStatusCodes: "Get Loan Status Codes",
	},
	es: {
		createLoan: "Crear Préstamo",
		cancelLoan: "Cancelar Préstamo",
		getAmortization: "Obtener Amortización",
		prequalification: "Precalificación",
		findPrequalificationMatches: "Buscar Coincidencias",
		// Loan Reads
		getLoan: "Obtener Préstamo",
		getLoanDetail1: "Obtener Detalle 1 del Préstamo",
		getPaymentInfo: "Obtener Info de Pago",
		getCollectionFields: "Obtener Campos de Cobranza",
		getStatuses: "Obtener Estatus del Préstamo",
		getPaymentHistory: "Obtener Historial de Pagos",
		getPaymentsDue: "Obtener Pagos Pendientes",
		getPayoffAmounts: "Obtener Montos de Liquidación",
		getPayoffDetails: "Obtener Detalle de Liquidación",
		// Collection Comments
		addCollectionComment: "Agregar Comentario de Cobranza",
		updateCollectionComment: "Actualizar Comentario de Cobranza",
		// Contacts & Search
		getContact: "Obtener Contacto",
		searchContacts: "Buscar Contactos",
		searchLoans: "Buscar Préstamos",
		// Calculations
		calculateAmortizedPayment: "Calcular Pago Amortizado",
		// Nuevas funciones
		getContactLoans: "Obtener Préstamos del Contacto",
		getContactPortfolio: "Obtener Portafolio del Contacto",
		getContactEmployments: "Obtener Empleos del Contacto",
		getLoanTransactions: "Obtener Transacciones del Préstamo",
		getAmortizationSchedule: "Obtener Tabla de Amortización",
		advancePeriod: "Avanzar Período",
		getLoanStatusCodes: "Obtener Códigos de Estatus",
	},
};

export function getNlsFunctionLabel(
	language: Language,
	functionId: string,
	fallbackLabel: string,
): string {
	return functionLabelOverrides[language]?.[functionId] ?? fallbackLabel;
}

const functionDescriptionOverrides: Record<Language, Record<string, string>> = {
	en: {
		prequalification:
			"Runs the full prequalification pipeline: customer save, credit pull, bureau data, SageMaker scoring, and rule evaluation. Supports applicant (existing user) or coapplicant (inline identity from form).",
		findPrequalificationMatches:
			"Searches for existing prequalification records matching the provided PII fields (SSN/ITIN, phone, email, userId). Returns full snapshots including bureau data and latest run.",
		searchContacts:
			"Searches NLS contacts by identity (TIN, email, phone, name, address). At least one filter required. Only non-empty filters are sent to NLS.",
		searchLoans:
			"Searches NLS loans by loan number, CIF, TIN, status, or short name. At least one filter required. Only non-empty filters are sent to NLS.",
	},
	es: {
		prequalification:
			"Ejecuta el pipeline completo de precalificación: guardado de cliente, consulta de crédito, datos del buró, scoring de SageMaker y evaluación de reglas. Soporta solicitante (usuario existente) o cosolicitante (identidad desde formulario).",
		findPrequalificationMatches:
			"Busca registros de precalificación existentes que coincidan con los campos PII proporcionados (SSN/ITIN, teléfono, email, userId). Devuelve snapshots completos incluyendo datos del buró y último run.",
		searchContacts:
			"Busca contactos en NLS por identidad (TIN, email, teléfono, nombre, dirección). Se requiere al menos un filtro. Solo se envían a NLS los filtros con valor.",
		searchLoans:
			"Busca préstamos en NLS por número, CIF, TIN, estatus o nombre corto. Se requiere al menos un filtro. Solo se envían a NLS los filtros con valor.",
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
