import {SyntaxNodeRef} from "@lezer/common"
import {Diagnostic} from "@codemirror/lint"
import {EditorView} from "codemirror"

import {findSuggestion, Suggestion, SuggestionKey} from "../index.ts"

export interface StateMachineContext {
    view: EditorView

    containerSuggestions: Suggestion[]
    keySuggestions: SuggestionKey[]
}

interface StateMachineItem {
    enter(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef): string | undefined

    leave(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef): void
}

class StateMachineNewLine implements StateMachineItem {
    public enter(_state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef): string | undefined {
        if (node.name === "NewLine") {
            return node.name
        }

        return undefined
    }

    public leave(state: StateMachine, _context: StateMachineContext, _node: SyntaxNodeRef) {
        state.state = undefined
    }
}

class StateMachineContainerStart implements StateMachineItem {
    public enter(_state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef): string | undefined {
        if (node.name === "ContainerStart") {
            return node.name
        }

        return undefined
    }

    public leave(state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef) {
        if (node.name !== "ContainerIdentifier") {
            state.diagnostics.push({
                from: node.from,
                to: node.to,
                severity: "error",
                message: "Container identifier missing"
            })
        }
    }
}

class StateMachineContainerIdentifier implements StateMachineItem {
    public enter(state: StateMachine, context: StateMachineContext, node: SyntaxNodeRef): string | undefined {
        if (node.name === "ContainerIdentifier") {
            const value = context.view.state.sliceDoc(node.from, node.to)
            const suggestion = findSuggestion(context.containerSuggestions, value)

            if (!suggestion) {
                state.diagnostics.push({
                    from: node.from,
                    to: node.to,
                    severity: "warning",
                    message: "Unknown container"
                })
            }

            return node.name
        }

        return undefined
    }

    public leave(state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef) {
        if (node.name !== "ContainerEnd") {
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
}

class StateMachineContainerEnd implements StateMachineItem {
    public enter(_state: StateMachine, _context: StateMachineContext, node: SyntaxNodeRef): string | undefined {
        if (node.name === "ContainerEnd") {
            return node.name
        }

        return undefined
    }

    public leave(state: StateMachine, _context: StateMachineContext, _node: SyntaxNodeRef) {
        state.state = undefined
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
            new StateMachineNewLine(),
            new StateMachineContainerStart(),
            new StateMachineContainerIdentifier(),
            new StateMachineContainerEnd()
        ]
    }

    public process(context: StateMachineContext, node: SyntaxNodeRef) {
        for (let i = 0; i < this.items.length; i++) {
            const state = this.items[i].enter(this, context, node)

            if (state === undefined) {
                continue
            }

            this.state = state

            if (this.item) {
                this.item.leave(this, context, node)
                this.item = undefined
            }

            this.item = this.items[i]

            break
        }
    }

    public clear() {
        this.state = undefined

        this.diagnostics = []

        this.item = undefined
    }
}