export default interface Lang {
    lint: {
        fix: string
        remove: string

        container: {
            identifier: string
            unknown: string
            end: string
        }

        value: {
            unknown: string
            assign: string
            missing: string

            enum: string
            range: string
            float: string
            int: string
            bool: string
        }
    }
}