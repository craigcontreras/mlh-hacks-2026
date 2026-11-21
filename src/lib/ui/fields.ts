export const fieldLabels = {
	patient: 'Patient display name',
	facility: 'Sending facility',
	callback: 'Facility callback extension'
} as const;

export const fieldOrder = ['patient', 'facility', 'callback'] as const;
