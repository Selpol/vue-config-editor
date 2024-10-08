import {defineComponent, h, PropType} from "vue"
import {Codemirror} from "vue-codemirror"

import {Extension} from "@codemirror/state"
import {syntaxTree} from "@codemirror/language"
import {CompletionContext, CompletionResult} from "@codemirror/autocomplete"

import {SyntaxNode} from "@lezer/common"

import {autocomplete, Suggestion, SuggestionKey} from "../index"

import {config, ConfigLELanguage} from "../lang"
import {findSuggestion} from "../util"

export default defineComponent({
    props: {
        modelValue: {type: String, required: true},

        disabled: {type: Boolean, default: false},

        containerSuggestions: {type: Array as PropType<Suggestion[]>, required: true},
        keySuggestions: {type: Array as PropType<SuggestionKey[]>, required: true},

        autocomplete: {type: Function as PropType<typeof autocomplete>, default: null},
    },
    emits: ['update:modelValue'],
    setup(props, ctx) {
        async function autocompleteContainer(node: SyntaxNode, context: CompletionContext): Promise<CompletionResult | null> {
            const segments = context.state.sliceDoc(node.from, node.to).split(".")

            if (segments.length == 0 || segments[0] == "") {
                return null
            }

            if (segments.length == 1) {
                const req = new RegExp(segments[0], "i")

                return {
                    from: node.from,
                    to: node.to,

                    options: props.containerSuggestions
                        .filter(item => req.test(item.value))
                        .map(item => ({label: item.value, detail: item.title, type: "constant"}))
                }
            }

            const suggestion = findSuggestion(props.containerSuggestions, segments.slice(0, segments.length - 1))

            if (suggestion) {
                if (suggestion[1].suggestions) {
                    const req = new RegExp(segments[suggestion[0]], "i")

                    return {
                        from: node.from + segments.reduce((a, b) => a + b.length, 0) + segments.length - segments[segments.length - 1].length - 1,
                        to: node.to,

                        options: suggestion[1].suggestions
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

            if (segments.length == 0 || segments[0] == "") {
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

            let suggestion = findSuggestion(props.keySuggestions, segments.slice(0, segments.length - 1))

            if (suggestion) {
                if (suggestion[1].suggestions) {
                    const req = new RegExp(segments[segments.length - 1], "i")

                    const suggestions = suggestion[1].suggestions.filter(item => req.test(item.value))

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

                    let variableSuggestion = suggestion[1].suggestions.find(item => item.type == "variable")

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

            if (prev && prev.name == "ValueIdentifier") {
                const next = node.nextSibling
                const value = (next ? context.state.sliceDoc(next.from, next.to) : "").trim()

                return await autocompleteNode(node, context.state.sliceDoc(prev.from, prev.to), value, 1)
            }

            return null
        }

        async function autocompleteOther(node: SyntaxNode, context: CompletionContext): Promise<CompletionResult | null> {
            let prev = node.prevSibling

            if (prev && prev.name == "Assign") {
                prev = prev.prevSibling

                if (prev && prev.name == "ValueIdentifier") {
                    const value = context.state.sliceDoc(node.from, node.to).trim()

                    return await autocompleteNode(node, context.state.sliceDoc(prev.from, prev.to), value, 0)
                }
            }

            return null
        }

        async function autocompleteNode(node: SyntaxNode, key: string, value: string, offset: number): Promise<CompletionResult | null> {
            const suggestion = findSuggestion(props.keySuggestions, key)

            if (!suggestion) {
                return null
            }

            if (suggestion[1].assign) {
                if (suggestion[1].assign.condition) {
                    const condition = suggestion[1].assign!.condition!

                    if (condition.startsWith("in:")) {
                        const reg = new RegExp(value, 'i')
                        const values = condition.substring(3).split(",")

                        return {
                            from: node.from + offset,

                            options: values
                                .filter(item => value == '' || reg.test(item))
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

                if (suggestion[1].assign.example) {
                    const reg = new RegExp(value, 'i')
                    const values = suggestion[1].assign.example.split(",")

                    return {
                        from: node.from + offset,

                        options: values
                            .filter(item => value == '' || reg.test(item))
                            .map(item => ({label: item, type: "text"}))
                    }
                }

                if (suggestion[1].assign.default) {
                    return {
                        from: node.from + offset,

                        options: [{label: suggestion[1].assign.default, type: "constant"}]
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

        const extensions: Extension[] = [
            config(),
            ConfigLELanguage.data.of({
                autocomplete: (context: CompletionContext): Promise<CompletionResult | null> | CompletionResult | null => {
                    let node = syntaxTree(context.state).resolveInner(context.pos, -1)

                    if (node.name == "ContainerIdentifier") {
                        return autocompleteContainer(node, context)
                    } else if (node.name == "ValueIdentifier") {
                        return autocompleteKey(node, context)
                    } else if (node.name == "Assign") {
                        return autocompleteAssign(node, context)
                    }

                    return autocompleteOther(node, context)
                }
            })
        ]

        return () => h(Codemirror, {
            modelValue: props.modelValue,

            disabled: props.disabled,

            extensions: extensions,

            "onUpdate:modelValue": (value: string) => ctx.emit("update:modelValue", value),
        })
    },
})