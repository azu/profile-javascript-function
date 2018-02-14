import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";

const template = require("@babel/template").default;

const fixturesDir = path.join(__dirname, "snapshots");
// 変換する関数
import { transform } from "../src/transform";

describe("Snapshot testing", () => {
    fs.readdirSync(fixturesDir).map(caseName => {
        const normalizedTestName = caseName.replace(/-/g, " ");
        it(`Test ${normalizedTestName}`, function() {
            const fixtureDir = path.join(fixturesDir, caseName);
            const actualFilePath = path.join(fixtureDir, "input.js");
            const actualContent = fs.readFileSync(actualFilePath, "utf-8");
            const actual = transform(actualContent, {
                functionStart() {
                    return template("start()");
                },
                functionEnd() {
                    return template("end");
                },
                functionReturn() {
                    return template("return 1");
                }
            }).code;
            const expectedFilePath = path.join(fixtureDir, "output.js");
            // UPDATE_SNAPSHOT=1 npm test で呼び出したときはスナップショットを更新
            if (process.env.UPDATE_SNAPSHOT) {
                fs.writeFileSync(expectedFilePath, JSON.stringify(actual, null, 4));
                this.skip(); // スキップ
                return;
            }
            // inputとoutputを比較する
            const expected = fs.readFileSync(expectedFilePath, "utf-8");
            assert.strictEqual(
                actual,
                expected,
                `
${fixtureDir}
${JSON.stringify(actual)}
`
            );
        });
    });
});
