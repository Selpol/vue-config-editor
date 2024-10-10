import type {Suggestion, SuggestionKey} from "../index.ts"

export interface FindSuggestionResult<T> {
    index: number

    suggestion?: T
}

export function findSuggestionStack<T extends Suggestion>(suggestions: T[], key: string | string[], strict: boolean = true): T[] {
    if (suggestions.length === 0) {
        return []
    }

    const result: T[] = []

    const segments = Array.isArray(key) ? key : key.split(".")

    let suggestion: T | undefined
    let index = 0

    do {
        if (!suggestion) {
            suggestion = suggestions.find(item => item.value === segments[0])

            index++

            if (suggestion) {
                result.push(suggestion)
            }

            continue
        }

        if (!suggestion.suggestions) {
            return strict ? [] : result
        }

        const tempSuggestion = suggestion.suggestions.find(item => item.value === segments[index]) as T | undefined

        if (tempSuggestion) {
            suggestion = tempSuggestion
        } else {
            suggestion = (suggestion.suggestions as SuggestionKey[]).find(item => item.type === 'variable') as T | undefined
        }

        if (suggestion) {
            result.push(suggestion)
        }

        index++
    } while (suggestion && index < segments.length)

    return result
}

export default function findSuggestion<T extends Suggestion>(suggestions: T[], key: string | string[]): FindSuggestionResult<T> {
    if (suggestions.length === 0) {
        return {index: 0, suggestion: undefined}
    }

    const segments = Array.isArray(key) ? key : key.split(".")

    let suggestion: T | undefined
    let index = 0

    do {
        if (!suggestion) {
            suggestion = suggestions.find(item => item.value === segments[0])

            index++

            continue
        }

        if (!suggestion.suggestions) {
            return {index: 0, suggestion: undefined}
        }

        const tempSuggestion = suggestion.suggestions.find(item => item.value === segments[index]) as T | undefined

        if (tempSuggestion) {
            suggestion = tempSuggestion
        } else {
            suggestion = (suggestion.suggestions as SuggestionKey[]).find(item => item.type === 'variable') as T | undefined
        }

        index++
    } while (suggestion && index < segments.length)

    if (suggestion) {
        return {index, suggestion}
    }

    return {index: 0, suggestion: undefined}
}