import { runDataConversionTests } from "./dataConversion.test";
import { runTooltipTests } from "./tooltip.test";

let failureCount = 0;

function run(name: string, testCase: () => void): void {
    try {
        testCase();
        console.log(`PASS ${name}`);
    } catch (error) {
        failureCount += 1;
        console.error(`FAIL ${name}`);
        console.error(error);
    }
}

runDataConversionTests(run);
runTooltipTests(run);

if (failureCount > 0) {
    process.exitCode = 1;
}
