import {SyntaxNodeRef} from "@lezer/common"
import {Diagnostic} from "@codemirror/lint"
import {EditorView} from "codemirror"

import {findSuggestion, Suggestion, SuggestionKey} from "../index.ts"

export interface StateMachineContext {
    view: EditorView

    containerSuggestions: Suggestion[]
    keySuggestions: SuggestionKey[]
}

type StateMachineItemEnter = [string | undefined, string[]]

interface StateMachineItem {
    readonly enter: StateMachineItemEnter
    readonly leave: string[]

    onEnter?(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef): void

    onLeave?(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef): void

    onError?(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef): void
}

class StateMachineContainerStart implements StateMachineItem {
    public readonly enter: StateMachineItemEnter = [undefined, ["ContainerStart"]]
    public readonly leave: string[] = ["ContainerIdentifier"]

    public onError(state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef) {
        state.diagnostics.push({
            from: node.from,
            to: node.to,
            severity: "error",
            message: "Container identifier missing"
        })
    }
}

class StateMachineContainerIdentifier implements StateMachineItem {
    public readonly enter: StateMachineItemEnter = ["ContainerStart", ["ContainerIdentifier"]]
    public readonly leave: string[] = ["ContainerEnd"]

    public onEnter(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef) {
        const suggestion = findSuggestion(context.containerSuggestions, context.view.state.sliceDoc(node.from, node.to))

        if (!suggestion) {
            state.diagnostics.push({
                from: node.from,
                to: node.to,
                severity: "warning",
                message: "Unknown container"
            })
        }
    }

    public onError(state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef) {
        state.diagnostics.push({
            from: node.to - 1,
            to: node.to - 1,
            severity: "error",
            message: "Container end missing",
            actions: [
                {
                    name: "Fix",
                    apply(view, from, to) {
                        view.dispatch({changes: {from, to, insert: "]"}})
                    }
                }
            ]
        })
    }
}

class StateMachineContainerEnd implements StateMachineItem {
    public readonly enter: StateMachineItemEnter = ["ContainerIdentifier", ["ContainerEnd"]]
    public readonly leave: string[] = []
}

class StateMachineValueStart implements StateMachineItem {
    public readonly enter: StateMachineItemEnter = [undefined, ["ValueIdentifier"]]
    public readonly leave: string[] = ["Assign"]

    public onEnter(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef) {
        const suggestion = findSuggestion(context.keySuggestions, context.view.state.sliceDoc(node.from, node.to))

        if (!suggestion) {
            state.diagnostics.push({
                from: node.from,
                to: node.to,
                severity: "warning",
                message: "Unknown value"
            })
        }
    }

    onError(state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef) {
        state.diagnostics.push({
            from: node.to,
            to: node.to,
            severity: "error",
            message: "Value assign missing",
            actions: [
                {
                    name: "Fix",
                    apply(view, from, to) {
                        view.dispatch({changes: {from, to, insert: "="}})
                    }
                }
            ]
        })
    }
}

class StateMachineValueAssign implements StateMachineItem {
    public readonly enter: StateMachineItemEnter = ["ValueIdentifier", ["Assign"]]
    public readonly leave: string[] = ["String", "Number", "Boolean"]

    onError(state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef) {
        state.diagnostics.push({
            from: node.from,
            to: node.to,
            severity: "error",
            message: "Value missing"
        })
    }
}

class StateMachineValueEnd implements StateMachineItem {
    public readonly enter: StateMachineItemEnter = ["Assign", ["String", "Number", "Boolean"]]
    public readonly leave: string[] = []

    onEnter(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef) {
        let prev = node.node.prevSibling

        if (prev && prev.name === "Assign") {
            prev = prev.prevSibling

            if (prev && prev.name === "ValueIdentifier") {
                const suggestion = findSuggestion(context.keySuggestions, context.view.state.sliceDoc(prev.from, prev.to))

                if (suggestion && suggestion[1].assign) {
                    const value = context.view.state.sliceDoc(node.from, node.to).trim()
                    const assign = suggestion[1].assign

                    if (assign.default && assign.default == value) {
                        state.diagnostics.push({
                            from: prev.from,
                            to: node.to,
                            severity: "hint",
                            message: "Default value",
                            actions: [
                                {
                                    name: "Remove",
                                    apply(view, from, to) {
                                        view.dispatch({changes: {from, to}})
                                    }
                                }
                            ]
                        })
                    } else if (assign.condition) {
                        if (assign.condition.startsWith("in:")) {
                            const segments = assign.condition.substring(3).split(",")

                            if (!segments.includes(value)) {
                                state.diagnostics.push({
                                    from: node.from,
                                    to: node.to,
                                    severity: "error",
                                    message: "Unknown enum value"
                                })
                            }
                        } else if (assign.condition.startsWith("between:")) {
                            const parse = parseInt(value)
                            const values = assign.condition.substring(8).split(",").map(item => parseInt(item)).filter(item => !isNaN(item))

                            if (values.length == 2 && (parse < values[0] || parse > values[1])) {
                                state.diagnostics.push({
                                    from: node.from,
                                    to: node.to,
                                    severity: "error",
                                    message: "Value is out of range " + values[0] + "-" + values[1]
                                })
                            }
                        }
                    }

                    if (assign.type) {
                        if (assign.type == "float") {
                            if (isNaN(parseFloat(value))) {
                                state.diagnostics.push({
                                    from: node.from,
                                    to: node.to,
                                    severity: "error",
                                    message: "Value is not float"
                                })
                            }
                        } else if (assign.type == "int") {
                            if (isNaN(parseInt(value))) {
                                state.diagnostics.push({
                                    from: node.from,
                                    to: node.to,
                                    severity: "error",
                                    message: "Value is not int"
                                })
                            }
                        } else if (assign.type == "bool") {
                            if (!["true", "false"].includes(value)) {
                                state.diagnostics.push({
                                    from: node.from,
                                    to: node.to,
                                    severity: "error",
                                    message: "Value is not bool"
                                })
                            }
                        }
                    }
                }
            }
        }
    }
}

export default class StateMachine {
    public state: string | undefined

    public diagnostics: Diagnostic[]

    private item: StateMachineItem | undefined
    private readonly items: StateMachineItem[]

    public constructor() {
        this.state = undefined
        this.diagnostics = []

        this.item = undefined
        this.items = [
            new StateMachineContainerStart(),
            new StateMachineContainerIdentifier(),
            new StateMachineContainerEnd(),

            new StateMachineValueStart(),
            new StateMachineValueAssign(),
            new StateMachineValueEnd()
        ]
    }

    public process(context: StateMachineContext, node: SyntaxNodeRef) {
        if (this.item) {
            if (this.item.leave.length > 0) {
                if (!this.item.leave.includes(node.name)) {
                    if (this.item.onError) {
                        this.item.onError(this, context, node)
                    }

                    this.item = undefined
                    this.state = undefined
                }
            } else {
                this.state = undefined
            }
        }

        const item = this.items.find(item => (item.enter[0] === undefined || item.enter[0] === this.state) && item.enter[1].includes(node.name))

        if (!item) {
            return
        }

        if (this.item && this.item.onLeave) {
            this.item.onLeave(this, context, node)
        }

        if (item.onEnter) {
            item.onEnter(this, context, node)
        }

        this.item = item
        this.state = node.name
    }

    public clear() {
        this.state = undefined

        this.diagnostics = []

        this.item = undefined
    }
}