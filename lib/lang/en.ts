import type Lang from "./index.ts"

const en: Lang = {
    lint: {
        fix: "Fix",
        remove: "Remove",

        container: {
            identifier: "Container identifier missing",
            unknown: "Container unknown value",
            end: "Container end missing",
        },

        value: {
            default: "Default value",

            unknown: "Unknown value",
            assign: "Value assign missing",
            missing: "Value missing",

            enum: "Unknown enum value",
            range: "Value is out of range",
            float: "Value is not float",
            int: "Value is not int",
            bool: "Value is not bool"
        }
    }
}

export default en