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
		leadIdentity: "Lead Identity",
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
		leadIdentity: "Identidad del Lead",
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
		birthDate: "Fecha de Nacimiento",
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
