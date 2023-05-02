import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

interface ListProps {
  title?: string
  items: TokenItem<InlineToken>[]
  ordered?: boolean
  margin?: boolean
  color?: TextProps['color']
}

const DOT = '•'

/**
 * `List` displays an unordered or ordered list with text aligned with the bullet point
 * and wrapped to the container width.
 */
const List: FunctionComponent<ListProps> = ({title, items, margin = true, ordered = false, color}): JSX.Element => {
  return (
    <Box flexDirection="column">
      {title ? (
        <Text bold color={color}>
          {title}
        </Text>
      ) : null}
      {items.map((item, index) => (
        <Box key={index} marginLeft={margin ? 2 : 0} gap={1}>
          <Text color={color}>{`${ordered ? `${index + 1}.` : DOT}`}</Text>

          <Text color={color}>
            <TokenizedText item={item} />
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export {List}
