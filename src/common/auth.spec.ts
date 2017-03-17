/* tslint:disable */
import * as Auth from "./auth";
import * as Database from "./database";
import * as crypto from "crypto";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as jwt from "jsonwebtoken";

const expect = chai.expect;
chai.use(chaiAsPromised);

// Test the auth Functions
describe("MatchMyRoute Auth Functions", () => {
    // Set up a test user in the database
    const secret = crypto.randomBytes(20).toString("base64");
    let uid;
    beforeAll(done => {
        Database.putUser(
            "Test User",
            "test@example.com",
            new Buffer("test"),
            new Buffer("test"),
            1,
            secret).then((u) => {
                uid = u.id
                done();
            }, err => {
                done();
            });
    });
    // Remove the test user
    afterAll(done => {
        Database.deleteUser(uid).then(() => {
            done();
        }, err => {
            done();
        });
    });
    // The tests
    describe("getIdFromJWT", () => {
        it("should accept auth by a correctly signed token", () => {
            const valid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + valid_token);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.eventually.equal(uid);
        });
        it("should not accept auth not in the Bearer <token> format", () => {
            const promise = Auth.getIdFromJWT("FooBar sadf89q23nnqmw.o8sdo2342");
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should not accept auth with a missing JWT token", () => {
            const promise = Auth.getIdFromJWT("Bearer");
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should not accept auth with an invaid JWT token", () => {
            const promise = Auth.getIdFromJWT("Bearer AHoq3bAJ#93ns98fq3lJKALjsa");
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should not accept auth with another user's token", () => {
            const invalid_token = jwt.sign({ id: uid - 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,	// 2 weeks
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should not accept auth by a token with a different issuer", () => {
            const invalid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "Another Issuer",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should not accept auth by an expired token", () => {
            const invalid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: -1,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should not accept auth by an unsigned token", () => {
            const invalid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "none",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
    });
    describe("generateJWTFor", () => {
        it("should create a reversible token", () => {
            const promise = Database.getUserById(uid).then(user => {
                const token = Auth.generateJWTFor(user);
                return jwt.verify(token, secret, {
                    algorithms: ["HS256"],
                    issuer: "MatchMyRoute Backend",
                }).id;
            });
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).not.to.throw;
            expect(promise).to.eventually.equal(uid);
        });
    });
    describe("isUser", () => {
        // Because this is a really simple wrapper function around getIdFrowJWT, we don't need to test JWT validity
        it("should resolve true for valid user token", () => {
            const valid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.isUser("Bearer " + valid_token, uid);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.eventually.equal(true);
        });
        it("should resolve false for invalid user token", () => {
            const invalid_token = jwt.sign({ id: uid + 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.isUser("Bearer " + invalid_token, uid);
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.eventually.equal(false);
        });
    });
    describe("doIfUser", () => {
        // This is a thin wrapper around isUser, so the main thing to check is that the function
        // is called if the auth is valid, and not if it isn't
        it("should complete the function with valid auth", () => {
            const valid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.doIfUser("Bearer " + valid_token, uid, () => {
                return "executed!";
            });
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.eventually.equal("executed!");
        });
        it("should not complete the function with invalid auth", () => {
            const invalid_token = jwt.sign({ id: uid + 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.doIfUser("Bearer " + invalid_token, uid, () => {
                return "executed!";
            }).catch(err => {
                return "rejected!";
            });
            expect(promise).to.eventually.equal("rejected!");
        });
    });
});
