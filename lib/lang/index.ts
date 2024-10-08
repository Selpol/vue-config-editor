import {parser} from "./config.grammar"
import {LRLanguage, LanguageSupport} from "@codemirror/language"

import {styleTags, tags as t} from "@lezer/highlight"

export const ConfigLELanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                "Comment": t.lineComment,

                "Container": t.emphasis,
                "ContainerIdentifier": t.tagName,
                "ValueIdentifier": t.string,

                "Assign": t.definitionOperator,

                "String": t.keyword,
                "Number": t.number,
                "Boolean": t.bool,
            })
        ]
    })
})

export function config() {
    return new LanguageSupport(ConfigLELanguage)
}