<template>
  <ConfigEditor v-model="value"
                :container-suggestions="containerSuggestions"
                :key-suggestions="identifierSuggestions"
                :autocomplete="autocomplete"/>
</template>

<script setup lang="ts">
import {ref} from "vue"

import ConfigEditor, {AutocompleteType, Suggestion, SuggestionKey} from "../lib"

const value = ref("# Device\n\n[device]\nauth=ssh")

const containerSuggestions: Suggestion[] = [
  {
    value: "device",
    title: "Device",

    suggestions: [
      {value: "Ubuntu", title: "Ubuntu Linux"},
      {value: "Debian", title: "Debian Linux"}
    ]
  }
]

const identifierSuggestions: SuggestionKey[] = [
  {
    value: "auth",
    title: "Authorization",

    assign: {condition: "in:telnet,ssh"},

    suggestions: [
      {
        type: "variable",
        value: "tty",
        title: "Tty",

        assign: {condition: "in:telnet,ssh"},

        suggestions: [
          {type: "value", value: "user", title: "User for login", assign: {example: "root,user"}},
          {type: "value", value: "ttl", title: "Connection timeout", assign: {condition: "between:0,100"}}
        ]
      },
      {type: "value", value: "user", title: "User for login", assign: {example: "root,user"}},
      {type: "value", value: "ttl", title: "Connection timeout", assign: {condition: "between:0,100"}}
    ]
  }
]

async function autocomplete(type: AutocompleteType, key: string, _value?: string): Promise<string[]> {
  if (type == "variable") {
    if (key == "auth.tty") {
      return (new Array(14)).fill(null).map((_, index) => index.toString())
    }
  }

  return []
}
</script>
