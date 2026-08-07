import * as React from "react"
import { PlusIcon, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TagInputProps {
  value?: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  label?: string
  error?: string
  /** Optional autocomplete choices, offered through a native datalist. */
  suggestions?: string[]
}

function TagInput({
  value,
  onChange,
  placeholder,
  label,
  error,
  suggestions,
}: Readonly<TagInputProps>) {
  const [input, setInput] = React.useState("")

  // Ids so the label, error text and datalist bind to the control.
  const id = React.useId()
  const errorId = `${id}-error`
  const listId = `${id}-suggestions`

  const tags = value ?? []

  const addTag = () => {
    const tag = input.trim()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setInput("")
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((v) => v !== tag))
  }

  return (
    <div className="w-full">
      {label && (
        <Label className="mb-2 block" htmlFor={id}>
          {label}
        </Label>
      )}
      <InputGroup className="w-full">
        <InputGroupInput
          id={id}
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Comma commits too, so pasted "a, b" style lists flow naturally.
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              addTag()
            }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          list={suggestions?.length ? listId : undefined}
        />
        <InputGroupAddon align="inline-end">
          <Tooltip>
            {/* render, not children: TooltipTrigger renders its own <button>,
                so nesting one here would be invalid HTML and would swallow
                the click before it reached the Add button. */}
            <TooltipTrigger
              render={
                <InputGroupButton
                  type="button"
                  onClick={addTag}
                  variant="default"
                  disabled={!input.trim()}
                />
              }
            >
              <PlusIcon />
              Add
            </TooltipTrigger>
            <TooltipContent>Add tag</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>

      {suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      )}

      {error && (
        <p id={errorId} className="text-destructive mt-1 text-sm">
          {error}
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:bg-muted ml-1 rounded-full"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {tag}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export { TagInput }
export type { TagInputProps }
