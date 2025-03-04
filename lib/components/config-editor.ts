import {defineComponent, h, type PropType} from "vue"
import {Codemirror} from "vue-codemirror"

import type {Extension} from "@codemirror/state"
import {LanguageSupport, LRLanguage, syntaxTree} from "@codemirror/language"
import type {CompletionContext, CompletionResult} from "@codemirror/autocomplete"
import {linter} from "@codemirror/lint"
import {hoverTooltip} from "@codemirror/view"

import type {SyntaxNode} from "@lezer/common"

import {autocomplete, findSuggestionStack, Suggestion, SuggestionKey} from "../index"

import {config, ConfigLELanguage} from "../grammar"
import {findSuggestion, StateMachine, type StateMachineContext} from "../util"

import type Lang from "../lang"
import en from "../lang/en.ts"

export interface Grammar {
    language: LRLanguage
    support: () => LanguageSupport
}

export default defineComponent({
    props: {
        modelValue: {type: String, required: true},

        disabled: {type: Boolean, default: false},

        containerSuggestions: {type: Array as PropType<Suggestion[]>, required: true},
        keySuggestions: {type: Array as PropType<SuggestionKey[]>, required: true},

        autocomplete: {type: Function as PropType<typeof autocomplete>, default: null},

        extensions: {type: Array as PropType<Extension[]>, default: null},

        lang: {type: Object as PropType<Lang>, default: () => en},
        grammar: {type: Object as PropType<Grammar>, default: () => ({language: ConfigLELanguage, support: config})}
    },
    emits: ['update:modelValue'],
    setup(props, ctx) {
        async function autocompleteContainer(node: SyntaxNode, context: CompletionContext): Promise<CompletionResult | null> {
            const segments = context.state.sliceDoc(node.from, node.to).split(".")

            if (segments.length === 0 || segments[0] === "") {
                return null
            }

            if (segments.length === 1) {
                const req = new RegExp(segments[0], "i")

                return {
                    from: node.from,
                    to: node.to,

                    options: props.containerSuggestions
                        .filter(item => req.test(item.value))
                        .map(item => ({label: item.value, detail: item.title, type: "constant"}))
                }
            }

            const result = findSuggestion(props.containerSuggestions, segments.slice(0, segments.length - 1))

            if (result.suggestion) {
                if (result.suggestion.suggestions) {
                    const req = new RegExp(segments[result.index], "i")

                    return {
                        from: node.from + segments.reduce((a, b) => a + b.length, 0) + segments.length - segments[segments.length - 1].length - 1,
                        to: node.to,

                        options: result.suggestion.suggestions
                            .filter(item => req.test(item.value))
                            .map(item => ({label: item.value, detail: item.title, type: "constant"}))
                    }
                }

                const values = await props.autocomplete("container", segments.slice(0, segments.length - 1).join("."), segments[segments.length - 1])

                return {
                    from: node.from + segments.reduce((a, b) => a + b.length, 0) + segments.length - segments[segments.length - 1].length - 1,
                    to: node.to,

                    options: values.map(item => ({label: item, type: "constant"}))
                }
            }

            return null
        }

        async function autocompleteKey(node: SyntaxNode, context: CompletionContext): Promise<CompletionResult | null> {
            const segments = context.state.sliceDoc(node.from, node.to).split(".")

            if (segments.length === 0 || segments[0] === "") {
                return null
            }

            if (segments.length == 1) {
                const req = new RegExp(segments[0], "i")

                return {
                    from: node.from,
                    to: node.to,

                    options: props.keySuggestions
                        .filter(item => req.test(item.value))
                        .map(item => ({label: item.value, detail: item.title, type: "type"}))
                }
            }

            let result = findSuggestion(props.keySuggestions, segments.slice(0, segments.length - 1))

            if (result.suggestion) {
                if (result.suggestion.suggestions) {
                    const req = new RegExp(segments[segments.length - 1], "i")

                    const suggestions = result.suggestion.suggestions.filter(item => req.test(item.value))

                    if (suggestions.length) {
                        return {
                            from: node.from + segments.reduce((a, b) => a + b.length, 0) + segments.length - segments[segments.length - 1].length - 1,
                            to: node.to,

                            options: suggestions.map(item => ({
                                label: item.value,
                                detail: item.title,
                                type: item.type == "variable" ? "variable" : "type"
                            }))
                        }
                    }

                    let variableSuggestion = result.suggestion.suggestions.find(item => item.type == "variable")

                    if (variableSuggestion) {
                        const values = await props.autocomplete("variable", segments.slice(0, segments.length - 1).join(".") + "." + variableSuggestion.value, segments[segments.length - 1])

                        return {
                            from: node.from + segments.reduce((a, b) => a + b.length, 0) + segments.length - segments[segments.length - 1].length - 1,
                            to: node.to,

                            options: values.map(item => ({label: item, type: "type"}))
                        }
                    }
                }

                const values = await props.autocomplete("key", segments.slice(0, segments.length - 1).join("."), segments[segments.length - 1])

                return {
                    from: node.from + segments.reduce((a, b) => a + b.length, 0) + segments.length - segments[segments.length - 1].length - 1,
                    to: node.to,

                    options: values.map(item => ({label: item, type: "type"}))
                }
            }

            return null
        }

        async function autocompleteAssign(node: SyntaxNode, context: CompletionContext): Promise<CompletionResult | null> {
            const prev = node.prevSibling

            if (prev && prev.name === "ValueIdentifier") {
                const next = node.nextSibling
                const value = (next ? context.state.sliceDoc(next.from, next.to) : "").trim()

                return await autocompleteNode(node, context.state.sliceDoc(prev.from, prev.to), value, 1)
            }

            return null
        }

        async function autocompleteOther(node: SyntaxNode, context: CompletionContext): Promise<CompletionResult | null> {
            if (node.name === "ContainerStart") {
                return {
                    from: node.to,
                    to: node.to,

                    options: props.containerSuggestions
                        .map(item => ({label: item.value, detail: item.title, type: "constant"}))
                }
            } else if (node.name === "Config") {
                return {
                    from: 0,
                    to: 0,

                    options: props.keySuggestions
                        .map(item => ({label: item.value, detail: item.title, type: "type"}))
                }
            } else if (node.name === "NewLine") {
                if (context.state.sliceDoc(node.from, node.to).endsWith("\n")) {
                    return {
                        from: node.to,
                        to: node.to,

                        options: props.keySuggestions
                            .map(item => ({label: item.value, detail: item.title, type: "type"}))
                    }
                }
            } else if (["String", "Number", "Boolean"].includes(node.name)) {
                const slice = context.state.sliceDoc(node.from, node.to)

                if (slice[context.pos - node.from - 1] === "\n") {
                    return {
                        from: node.to,
                        to: node.to,

                        options: props.keySuggestions
                            .map(item => ({label: item.value, detail: item.title, type: "type"}))
                    }
                }
            }

            let prev = node.prevSibling

            if (prev && prev.name === "Assign") {
                prev = prev.prevSibling

                if (prev && prev.name === "ValueIdentifier") {
                    const value = context.state.sliceDoc(node.from, node.to).trim()

                    return await autocompleteNode(node, context.state.sliceDoc(prev.from, prev.to), value, 0)
                }
            }

            return null
        }

        async function autocompleteNode(node: SyntaxNode, key: string, value: string, offset: number): Promise<CompletionResult | null> {
            const result = findSuggestion(props.keySuggestions, key)

            if (!result.suggestion) {
                return null
            }

            if (result.suggestion.assign) {
                if (result.suggestion.assign.condition) {
                    const condition = result.suggestion.assign!.condition!

                    if (condition.startsWith("in:")) {
                        const reg = new RegExp(value, 'i')
                        const values = condition.substring(3).split(",")

                        return {
                            from: node.from + offset,

                            options: values
                                .filter(item => value === '' || reg.test(item))
                                .map(item => ({label: item, type: "enum"}))
                        }
                    } else if (condition.startsWith("between:")) {
                        const req = new RegExp(value, 'i')
                        const values = condition.substring(8).split(",").map(item => parseInt(item)).filter(item => !isNaN(item))

                        if (values.length == 2 && ((values[1] - values[0]) <= 256)) {
                            const array = (new Array(values[1] - values[0])).fill(null).map((_, index) => (index + values[0]).toString())

                            return {
                                from: node.from + offset,

                                options: array
                                    .filter(item => req.test(item))
                                    .map(item => ({label: item, type: "enum"}))
                            }
                        }
                    }
                }

                if (result.suggestion.assign.example) {
                    const reg = new RegExp(value, 'i')
                    const values = result.suggestion.assign.example.split(",")

                    return {
                        from: node.from + offset,

                        options: values
                            .filter(item => value === '' || reg.test(item))
                            .map(item => ({label: item, type: "text"}))
                    }
                }

                if (result.suggestion.assign.default) {
                    return {
                        from: node.from + offset,

                        options: [{label: result.suggestion.assign.default, type: "constant"}]
                    }
                }
            }

            if (props.autocomplete) {
                const values = await props.autocomplete("value", key, value)

                return {
                    from: node.from + offset,

                    options: values.map(item => ({label: item, type: "text"}))
                }
            }

            return null
        }

        const state = new StateMachine()

        const extensions: Extension[] = [
            props.grammar.support(),
            props.grammar.language.data.of({
                autocomplete: (context: CompletionContext): Promise<CompletionResult | null> | CompletionResult | null => {
                    let node = syntaxTree(context.state).resolveInner(context.pos, -1)

                    if (node.name === "ContainerIdentifier") {
                        return autocompleteContainer(node, context)
                    } else if (node.name === "ValueIdentifier") {
                        return autocompleteKey(node, context)
                    } else if (node.name === "Assign") {
                        return autocompleteAssign(node, context)
                    }

                    return autocompleteOther(node, context)
                }
            }),
            linter(view => {
                state.clear()

                const context: StateMachineContext = {
                    lang: props.lang,
                    view,

                    containerSuggestions: props.containerSuggestions,
                    keySuggestions: props.keySuggestions
                }

                syntaxTree(view.state).cursor().iterate(node => state.process(context, node))

                return state.diagnostics
            }),
            hoverTooltip((view, pos) => {
                let node = syntaxTree(view.state).resolveInner(pos, -1)

                if (node.name === "ContainerIdentifier" || node.name === "ValueIdentifier") {
                    const value = view.state.sliceDoc(node.from, node.to)
                    const index = value.indexOf(".", pos - node.from)

                    const suggestions = findSuggestionStack(node.name === "ContainerIdentifier" ? props.containerSuggestions : props.keySuggestions, index != -1 ? value.substring(0, index) : value)

                    if (suggestions.length > 0) {
                        return {
                            pos,
                            above: true,
                            strictSide: true,
                            arrow: true,
                            create: () => {
                                const element = document.createElement("div")
                                element.className = "cm-tooltip-cursor"
                                element.style.padding = "3px 6px 3px 8px"
                                element.textContent = suggestions.map(item => item.title).join(" > ")

                                return {dom: element}
                            }
                        }
                    }
                }

                return null
            })
        ]

        if (props.extensions && props.extensions.length > 0) {
            extensions.push(...props.extensions)
        }

        return () => h(Codemirror, {
            modelValue: props.modelValue,

            disabled: props.disabled,

            extensions: extensions,

            "onUpdate:modelValue": (value: string) => ctx.emit("update:modelValue", value),
        })
    },
})