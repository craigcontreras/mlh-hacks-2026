// These synthetic passcodes are also printed on the demo sign-in screen.
export const demoPasscodes = {
	admin: 'maya-demo-104', doctor: 'avery-demo-104', nurse: 'riley-demo-104', 'doctor-morgan': 'morgan-demo-104'
};

export const signInSteps = { nurse: 1, doctor: 4, admin: 9, 'doctor-morgan': 12 } as const;
