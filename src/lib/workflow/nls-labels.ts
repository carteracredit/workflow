/**
 * NLS label overrides by language.
 * Used to translate field labels and section labels from the catalog
 * (which come in English from proxy-svc) into the user's preferred language.
 */

type Language = "en" | "es";

const sectionLabelOverrides: Record<Language, Record<string, string>> = {
	en: {
		mode: "Mode",
		caseAttached: "Case Attached",
		leadIdentity: "Lead Identity (from form node)",
		loan: "Loan",
		collateral: "Collateral",
		employment: "Employment",
		references: "References",
		seller: "Seller",
		client: "Client",
	},
	es: {
		mode: "Modo",
		caseAttached: "Caso Asociado",
		leadIdentity: "Identidad del Lead (desde nodo formulario)",
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
		mode: "Mode",
		pullType: "Pull Type",
		userId: "User ID",
		firstName: "First Name",
		middleName: "Middle Name",
		lastName: "Last Name",
		email: "Email",
		birthDate: "Birth Date",
		phoneNumber: "Phone Number",
		taxIdType: "Tax ID Type",
		taxIdNumber: "Tax ID Number",
		addressStreetNumber: "Street Number",
		addressStreetName: "Street Name",
		addressApt: "Apt/Suite",
		addressCity: "City",
		addressState: "State",
		addressZipCode: "Zip Code",
	},
	es: {
		mode: "Modo",
		pullType: "Tipo de Consulta",
		userId: "ID de Usuario",
		firstName: "Nombre",
		middleName: "Segundo Nombre",
		lastName: "Apellido",
		email: "Correo Electrónico",
		birthDate: "Fecha de Nacimiento (AAAA-MM-DD)",
		phoneNumber: "Número de Teléfono",
		taxIdType: "Tipo de ID Fiscal",
		taxIdNumber: "Número de ID Fiscal",
		addressStreetNumber: "Número de Calle",
		addressStreetName: "Nombre de Calle",
		addressApt: "Apt/Suite",
		addressCity: "Ciudad",
		addressState: "Estado",
		addressZipCode: "Código Postal",
	},
};

const optionLabelOverrides: Record<Language, Record<string, string>> = {
	en: {
		case_attached: "Case Attached",
		lead: "Lead",
		soft: "Soft",
		hard: "Hard",
		new: "New",
		SSN: "SSN",
		ITIN: "ITIN",
	},
	es: {
		case_attached: "Caso Asociado",
		lead: "Lead",
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
		precalification:
			"Runs the full prequalification pipeline: customer save, credit pull, bureau data, SageMaker scoring, and rule evaluation. Supports case_attached mode (existing user) or lead mode (inline identity from form).",
	},
	es: {
		precalification:
			"Ejecuta el pipeline completo de precalificación: guardado de cliente, consulta de crédito, datos del buró, scoring de SageMaker y evaluación de reglas. Soporta modo caso asociado (usuario existente) o modo lead (identidad desde formulario).",
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
