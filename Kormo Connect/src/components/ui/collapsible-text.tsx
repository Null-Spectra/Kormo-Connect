import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface CollapsibleTextProps {
  text: string
  maxLength?: number
  className?: string
  expandedClassName?: string
  collapsedClassName?: string
  buttonClassName?: string
  showIcon?: boolean
}

export const CollapsibleText: React.FC<CollapsibleTextProps> = ({
  text,
  maxLength = 180,
  className = '',
  expandedClassName = '',
  collapsedClassName = '',
  buttonClassName = '',
  showIcon = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // If text is shorter than maxLength, don't show expand/collapse
  if (!text || text.length <= maxLength) {
    return <p className={cn('text-gray-600 leading-relaxed', className)}>{text}</p>
  }

  // Find a good breaking point (end of word or sentence)
  const findBreakPoint = (str: string, max: number): number => {
    if (str.length <= max) return str.length
    
    // Try to break at sentence end (. ! ?)
    const sentenceEnd = str.lastIndexOf('.', max)
    if (sentenceEnd > max * 0.7) return sentenceEnd + 1
    
    // Try to break at word boundary
    const spaceIndex = str.lastIndexOf(' ', max)
    if (spaceIndex > max * 0.7) return spaceIndex
    
    // Fallback to exact maxLength
    return max
  }

  const breakPoint = findBreakPoint(text, maxLength)
  const truncatedText = text.substring(0, breakPoint).trim()
  const shouldShowEllipsis = truncatedText.length < text.length && !truncatedText.endsWith('.')

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          className
        )}
      >
        <p
          className={cn(
            'text-gray-600 leading-relaxed',
            isExpanded ? expandedClassName : collapsedClassName
          )}
          aria-expanded={isExpanded}
        >
          {isExpanded ? text : `${truncatedText}${shouldShowEllipsis ? '...' : ''}`}
        </p>
      </div>
      
      <button
        onClick={toggleExpanded}
        onKeyPress={handleKeyPress}
        className={cn(
          'inline-flex items-center text-sm font-medium transition-colors duration-200',
          'text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2',
          'focus:ring-blue-500 focus:ring-offset-2 rounded-sm',
          buttonClassName
        )}
        aria-label={isExpanded ? 'Show less text' : 'Show more text'}
        aria-controls="collapsible-text-content"
      >
        {isExpanded ? (
          <>
            Show less
            {showIcon && <ChevronUp className="ml-1 h-4 w-4" />}
          </>
        ) : (
          <>
            Read more
            {showIcon && <ChevronDown className="ml-1 h-4 w-4" />}
          </>
        )}
      </button>
    </div>
  )
}
