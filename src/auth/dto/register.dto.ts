export class RegisterDto {
    readonly fullName: string;
    readonly email: string;
    readonly password: string;
    readonly gender: 'male' | 'female';
    readonly birthday?: Date;
}
