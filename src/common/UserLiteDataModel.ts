export class UserLiteDataModel {
    public id: number;
    public email: string;
    public name: string;

    constructor(obj) {
        this.id = obj.id;
        this.email = obj.email;
        this.name = obj.name;
    }
}
