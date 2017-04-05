// Only a User's settings
export interface IUserSettings {
    id: number;
    email: string;
    name: string;
    pwh: Buffer;
    salt: Buffer;
    rounds: number;
    jwtSecret: string;
}

// Only a User's profile info
export interface IUserProfile {
    id: number;
    email: string;
    name: string;
    bio: string;
    photo: string;
    joined: number;
    helped: number;
}

// This is a user object
export default class User implements IUserSettings, IUserProfile {
    public static fromSQLRow(row): User {
        return new User({
            bio: row.profile_bio,
            email: row.email,
            helped: row.profile_helped,
            id: row.id,
            joined: row.profile_joined,
            jwtSecret: row.jwt_secret,
            name: row.name,
            photo: row.profile_photo,
            pwh: row.pwh,
            rounds: row.rounds,
            salt: row.salt,
        });
    }

    public id: number;
    public email: string;
    public name: string;
    public pwh: Buffer;
    public salt: Buffer;
    public rounds: number;
    public jwtSecret: string;
    public bio: string;
    public photo: string;
    public joined: number;
    public helped: number;

    constructor(obj) {
        if (!obj.email.trim().length) {
            throw "User object requires an email";
        } else if (!obj.name.trim().length) {
            throw "User object requires a name";
        } else if (!obj.pwh.length) {
            throw "User object requires a password hash";
        } else if (!obj.salt.length) {
            throw "User object requires a password salt";
        } else if (!obj.rounds) {
            throw "User object requires the number of hashing rounds to be set";
        } else if (!obj.jwtSecret.trim().length) {
            throw "User object requires a JWT secret";
        }
        this.id = obj.id;
        this.email = obj.email;
        this.name = obj.name;
        this.pwh = obj.pwh;
        this.salt = obj.salt;
        this.rounds = obj.rounds;
        this.jwtSecret = obj.jwtSecret;
        this.bio = obj.bio;
        this.photo = obj.photo;
        this.joined = obj.joined;
        this.helped = obj.helped;
    }

    public asUserSettings(): IUserSettings {
        return {
            email: this.email,
            id: this.id,
            jwtSecret: this.jwtSecret,
            name: this.name,
            pwh: this.pwh,
            rounds: this.rounds,
            salt: this.salt,
        } as IUserSettings;
    }

    public asUserProfile(): IUserProfile {
        return {
            bio: this.bio,
            email: this.email,
            helped: this.helped,
            id: this.id,
            joined: this.joined,
            name: this.name,
            photo: this.photo,
        } as IUserProfile;
    }
}
