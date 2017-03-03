import { callResizeFn } from "./resize";

describe("images: resize", () => {
    let ops;
    let md;

    beforeEach(() => {
        ops = {};
        md = {
            height: 5000,
            width: 4000,
        };
    });

    function testLongestSideBigImage(size) {
        return (width, height) => {
            const max = Math.max(width, height);
            const min = Math.min(width, height);

            expect(max).toBe(size);
            expect(min).toBe(min / max * size);
        };
    }

    it("business is 100% original", () => {
        const myFn = testLongestSideBigImage(Math.max(md.width, md.height));
        callResizeFn.business(myFn, ops, md);
    });

    it("business is 100% original also for small images", () => {
        md.width = 30;
        md.height = 70;
        const myFn = testLongestSideBigImage(Math.max(md.width, md.height));
        callResizeFn.business(myFn, ops, md);
    });

    it("thumbnail is 100px the longest side", () => {
        const myFn = testLongestSideBigImage(100);
        callResizeFn.thumbnail(myFn, ops, md);
    });

    it("thumbnail is 100px the longest side also for small images", () => {
        md.width = 30;
        md.height = 70;
        const myFn = testLongestSideBigImage(100);
        callResizeFn.thumbnail(myFn, ops, md);
    });

    it("cc is 1080px the longest side", () => {
        const myFn = testLongestSideBigImage(1080);
        callResizeFn.cc(myFn, ops, md);
    });

    it("cc is 1080px the longest side also for small images", () => {
        md.width = 30;
        md.height = 70;
        const myFn = testLongestSideBigImage(1080);
        callResizeFn.cc(myFn, ops, md);
    });

    it("personal is 1500px the longest side", () => {
        const myFn = testLongestSideBigImage(1500);
        callResizeFn.personal(myFn, ops, md);
    });

    it("personal is 1500px the longest side also for small images", () => {
        md.width = 30;
        md.height = 70;
        const myFn = testLongestSideBigImage(1500);
        callResizeFn.personal(myFn, ops, md);
    });
});
