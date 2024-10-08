import {ConfigEditor} from "./components"

export type SuggestionType = "namespace" | "value" | "variable"
export type AutocompleteType = "container" | "key" | "variable" | "value"

export interface Suggestion {
    value: string
    title: string

    suggestions?: Suggestion[]
}

export interface SuggestionAssign {
    type?: "array" | "string" | "float" | "int" | "bool" | string

    default?: string
    example?: string

    condition?: string
}

export interface SuggestionKey extends Suggestion {
    type?: SuggestionType
    assign?: SuggestionAssign

    suggestions?: SuggestionKey[]
}

export declare function autocomplete(type: AutocompleteType, key: string, value?: string): Promise<string[]> | string[];

export * from "./util"

export default ConfigEditor