# Vue config editor

Pseudo toml config editor with suggestions

## Usage

### Install

```shell
npm install vue-code-editor
```

### Local component

```vue

<template>
  <ConfigEditor v-model="value"
                :container-suggestions="containerSuggestions"
                :key-suggestions="identifierSuggestions"
                :autocomplete="autocomplete"/>
</template>

<script setup lang="ts">
  import {ref} from "vue"

  import ConfigEditor, {AutocompleteType, Suggestion, SuggestionKey} from "../lib"

  const value = ref("")

  const containerSuggestions: Suggestion[] = []
  const identifierSuggestions: SuggestionKey[] = []

  async function autocomplete(type: AutocompleteType, key: string, value?: string): Promise<string[]> {
    return []
  }
</script>
```

### Example container suggestions

```typescript
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
```

### Example key suggestions

```typescript
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
```

### Example autocomplete

```typescript
async function autocomplete(type: AutocompleteType, key: string, value?: string): Promise<string[]> {
    if (type == "variable") {
        if (key == "auth.tty") {
            return (new Array(14)).fill(null).map((_, index) => index.toString())
        }
    }

    return []
}
```

## License

Licensed under the [MIT](./LICENSE) License.