// Only a User's settings
export interface IUserSettings {
    id: string;
    email: string;
    name: string;
    pwh: Buffer;
    salt: Buffer;
    rounds: number;
    jwtSecret: string;
}

// Only a User's profile info
export interface IUserProfile {
    bio: string;
    distance: number;
    email: string;
    helpedCount: number;
    id: string;
    name: string;
    joined: number;
    photo: string;
    preferences: {
        rideDifficulty: string;
        units: string;
    };
    rating: number;
    usersHelped: number;
}

// This is a user object
export default class User implements IUserSettings, IUserProfile {
    public static fromSQLRow(row): User {
        let rating = row.profile_rating_sum / row.profile_help_count;
        if (row.profile_rating_sum === 0 && row.profile_help_count === 0) {
            rating = 0;
        }
        return new User({
            bio: row.profile_bio,
            distance: row.profile_distance,
            email: row.email,
            helpedCount: row.profile_helped_count,
            id: row.id,
            joined: row.profile_joined,
            jwtSecret: row.jwt_secret,
            name: row.name,
            photo: row.profile_photo,
            preferences: {
                rideDifficulty: row.preferences_difficulty,
                units: row.preferences_units,
            },
            pwh: row.pwh,
            rating,
            rounds: row.rounds,
            salt: row.salt,
            usersHelped: row.profile_help_count,
        });
    }

    public id: string;
    public email: string;
    public name: string;
    public pwh: Buffer;
    public salt: Buffer;
    public rounds: number;
    public jwtSecret: string;
    public bio: string;
    public photo: string;
    public joined: number;
    public helpedCount: number;
    public usersHelped: number;
    public rating: number;
    public distance: number;
    public preferences: {
        rideDifficulty: string;
        units: string;
    };

    constructor(obj) {
        if (!obj.email.trim().length) {
            throw "User object requires an email";
        } else if (!obj.name.trim().length) {
            throw "User object requires a name";
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
        this.distance = obj.distance;
        this.usersHelped = obj.usersHelped;
        this.helpedCount = obj.helpedCount;
        this.rating = obj.rating;
        this.preferences = obj.preferences;
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
            distance: this.distance,
            email: this.email,
            helpedCount: this.helpedCount,
            id: this.id,
            joined: this.joined,
            name: this.name,
            photo: this.photo,
            preferences: this.preferences,
            rating: this.rating,
            usersHelped: this.usersHelped,
        } as IUserProfile;
    }
}
