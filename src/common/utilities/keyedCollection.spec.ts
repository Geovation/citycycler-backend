/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as chai from "chai";

import { KeyedCollection } from ".";

const expect = chai.expect;

interface ITestObject {
    bool: boolean;
    num: number;
    str: string;
};

class TestDictionary extends KeyedCollection<ITestObject> {};
let emptyCollection: TestDictionary;
let collection: TestDictionary;
const testNum: number = 5;
const testString: string = "hello";
const testBool: boolean = false;
const testKey: string = "isThere";
const testNotKey: string = "isNotThere";
const testObj: ITestObject = {
    bool: testBool,
    num: testNum,
    str: testString,
};

describe("Timepix API", () => {

    beforeEach(() => {
        emptyCollection = new TestDictionary();
        collection = new TestDictionary();
        collection.add(testKey, testObj);
    });

    describe("KeyedCollection", () => {
        it("empty collection should be empty", () => {
            expect(emptyCollection.count()).to.equal(0);
            expect(emptyCollection.keys()).to.be.empty;
            expect(emptyCollection.values()).to.be.empty;
        });

        it("add test object", () => {
            expect(collection.count()).to.equal(1);
            const keys: string[] = collection.keys();
            expect(keys).to.have.lengthOf(1);
            expect(keys).to.eql([testKey]);
            expect(collection.containsKey(testKey)).to.be.true;
            expect(collection.containsKey(testNotKey)).to.be.false;
            const vals: ITestObject[] = collection.values();
            expect(vals).to.have.lengthOf(1);
            expect(collection.item(testKey)).to.not.be.empty;
            expect(collection.item(testNotKey)).to.be.empty;
        });

        it("remove test object", () => {
            expect(collection.remove(testNotKey)).to.be.empty;
            expect(collection.count()).to.equal(1);
            const myTestObj: ITestObject = collection.remove(testKey);
            expect(collection.count()).to.equal(0);
            expect(collection.keys()).to.be.empty;
            expect(collection.values()).to.be.empty;
            expect(myTestObj).to.eql(testObj);
            expect(myTestObj.num).to.equal(testNum);
            expect(myTestObj.str).to.equal(testString);
            expect(myTestObj.bool).to.be.false;
        });
    });

});
