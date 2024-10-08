import {Suggestion, SuggestionKey} from "../index.ts"

export default function findSuggestion<T extends Suggestion>(suggestions: T[], key: string | string[]): [number, T] | undefined {
    if (suggestions.length == 0) {
        return undefined
    }

    const segments = Array.isArray(key) ? key : key.split(".")

    let suggestion = suggestions.find(item => item.value == segments[0])
    let index = 1

    while (suggestion && index < segments.length) {
        if (!suggestion.suggestions) {
            return undefined
        }

        const tempSuggestion = suggestion.suggestions.find(item => item.value == segments[index]) as T | undefined

        if (tempSuggestion) {
            suggestion = tempSuggestion
        } else {
            suggestion = (suggestion.suggestions as SuggestionKey[]).find(item => item.type == 'variable') as T | undefined
        }

        index++
    }

    if (suggestion) {
        return [index, suggestion]
    }

    return undefined
}
