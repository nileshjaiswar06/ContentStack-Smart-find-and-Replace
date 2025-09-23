# Smart Find & Replace - Layout Structure

## Full-Page Application Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Logo] Smart Find & Replace                    [Settings][Help] │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA                                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Breadcrumb: Home / Smart Find & Replace                     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ TABS: [Find Content] [Replace Content] [Preview] [History]  │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │                                                             │ │
│ │ TAB CONTENT AREA                                            │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ FIND TAB:                                               │ │ │
│ │ │ ┌─────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ Search Query Input                                  │ │ │ │
│ │ │ │ [Content Type] [Locale] [Status] Filters            │ │ │ │
│ │ │ │                                    [Search Button]  │ │ │ │
│ │ │ └─────────────────────────────────────────────────────┘ │ │ │
│ │ │                                                         │ │ │
│ │ │ SEARCH RESULTS TABLE:                                   │ │ │
│ │ │ ┌─────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ [✓] Title | Content Type | Locale | Status          │ │ │ │
│ │ │ │ [✓] Entry 1 | Article | en-us | Published          │ │ │ │
│ │ │ │ [✓] Entry 2 | Product | en-us | Draft              │ │ │ │
│ │ │ │ [✓] Entry 3 | Blog | en-us | Published             │ │ │ │
│ │ │ └─────────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ REPLACE TAB:                                                │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Replace With Input                                      │ │ │
│ │ │ [Replace Mode] [Case Sensitive] Options                 │ │ │
│ │ │                                    [Replace Button]    │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ PREVIEW TAB:                                                │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Preview Changes Display                                 │ │ │
│ │ │ Success Messages & Change Details                       │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ HISTORY TAB:                                                │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Operation History Timeline                              │ │ │
│ │ │ Recent Actions & Timestamps                             │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ FOOTER                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Smart Find & Replace v1.0.0    [Documentation] [Support]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. **Header Section**
- Logo and application title
- Settings and Help buttons
- Clean, professional appearance

### 2. **Navigation**
- Breadcrumb navigation
- Tab-based interface for different functions
- Clear visual hierarchy

### 3. **Find Content Tab**
- Search query input
- Advanced filters (Content Type, Locale, Status)
- Search results table with checkboxes
- Real-time search functionality

### 4. **Replace Content Tab**
- Replacement text input
- Replace mode options (All, First, Last)
- Case sensitivity toggle
- Batch replace functionality

### 5. **Preview Tab**
- Shows changes before applying
- Success/error messages
- Detailed change log

### 6. **History Tab**
- Operation timeline
- Recent actions tracking
- Audit trail

### 7. **Footer**
- Version information
- Help links
- Professional branding

## Design Principles

1. **Contentstack-like UI**: Clean, modern interface similar to Contentstack's design system
2. **Full-page Application**: No sidebar, uses full viewport width
3. **Responsive Design**: Works on desktop and mobile devices
4. **Intuitive Workflow**: Logical flow from find → replace → preview → history
5. **Professional Appearance**: Enterprise-grade UI suitable for content management

## Color Scheme

- **Primary**: Indigo (#6366f1)
- **Secondary**: Gray (#f1f5f9)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#f59e0b)
- **Error**: Red (#ef4444)
- **Background**: Light Gray (#f9fafb)
- **Text**: Dark Gray (#111827)

## Typography

- **Headers**: Inter/System fonts, 600-700 weight
- **Body**: Inter/System fonts, 400-500 weight
- **Code**: Monospace fonts
- **Sizes**: 12px-24px range for different elements