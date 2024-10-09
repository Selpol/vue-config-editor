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
            new StateMachineContainerEnd()
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