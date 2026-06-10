export interface Metadata {
  generatedBy?: string;
  generatedAt?: string;
  source?: string;
  license?: string;
  [key: string]: unknown;
}

export interface PlatformStatus {
  stage: 'draft' | 'experimental' | 'stable' | 'deprecated';
  since?: string;
  migrateTo?: string;
  note?: string;
  [key: string]: unknown;
}

export interface StatusObject {
  default: 'draft' | 'experimental' | 'stable' | 'deprecated';
  platforms?: Record<string, PlatformStatus>;
  [key: string]: unknown;
}

export type LifecycleStatus =
  | 'draft'
  | 'experimental'
  | 'stable'
  | 'deprecated'
  | StatusObject;

export interface AliasReference {
  category: string;
  token: string;
  [key: string]: unknown;
}

export interface TokenEntry {
  value: string;
  description?: string;
  type?: string;
  deprecated?: boolean;
  aliases?: string[];
  status?: LifecycleStatus;
  tier?: 'primitive' | 'semantic' | 'component';
  aliasOf?: string | AliasReference;
  [key: string]: unknown;
}

export interface TokenCategory {
  description?: string;
  tier?: 'primitive' | 'semantic' | 'component';
  values: Record<string, TokenEntry>;
  [key: string]: unknown;
}

export interface ValueDescriptor {
  value: unknown;
  description?: string;
  deprecated?: boolean;
  [key: string]: unknown;
}

export interface PropDescriptor {
  type: string;
  description?: string;
  values?: unknown[];
  default?: unknown;
  required?: boolean;
  propRole?: 'flag' | 'dimension' | 'choice' | 'slot' | 'handler' | 'content' | 'state';
  [key: string]: unknown;
}

export interface AttributeDescriptor {
  attribute: string;
  description?: string;
  condition?: string;
  [key: string]: unknown;
}

export interface KeyboardInteraction {
  key: string;
  description: string;
  [key: string]: unknown;
}

export interface AccessibilityConstraints {
  role?: string;
  labelRequirement?: 'required-visible' | 'required-accessible-name' | 'required-aria' | 'optional' | 'none';
  requiredAttributes?: AttributeDescriptor[];
  keyboardInteractions?: KeyboardInteraction[];
  contrastRequirement?: string;
  focusManagement?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface SubComponentDescriptor {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  slot?: string;
  acceptsChildren?: 'any' | 'text' | 'components' | 'none';
  [key: string]: unknown;
}

export interface CompositionRules {
  subComponents?: SubComponentDescriptor[];
  requiredChildren?: string[];
  allowedChildren?: string[];
  requiredParent?: string;
  allowedParents?: string[];
  requiredSiblings?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface ConstraintEntry {
  context: string;
  rule: string;
  severity: 'must' | 'should' | 'should-not' | 'must-not';
  [key: string]: unknown;
}

export interface ComponentEntry {
  name: string;
  description: string;
  whenToUse?: string;
  whenNotToUse?: string;
  props?: Record<string, PropDescriptor>;
  tokens?: string[];
  relatedComponents?: string[];
  tags?: string[];
  deprecated?: boolean;
  deprecatedMessage?: string;
  status?: LifecycleStatus;
  accessibility?: AccessibilityConstraints;
  composition?: CompositionRules;
  constraints?: ConstraintEntry[];
  [key: string]: unknown;
}

export interface PatternEntry {
  id: string;
  name: string;
  description: string;
  intent?: string;
  context?: string;
  components?: string[];
  guidance?: string;
  relatedPatterns?: string[];
  tags?: string[];
  [key: string]: unknown;
}

export interface AntiPatternEntry {
  id: string;
  name: string;
  description: string;
  reason: string;
  insteadUse?: string;
  components?: string[];
  tags?: string[];
  severity?: 'must-not' | 'should-not' | 'discouraged';
  [key: string]: unknown;
}

export interface SubComponentBinding {
  exportName?: string;
  importPath?: string;
  [key: string]: unknown;
}

export interface ComponentBinding {
  importPath?: string;
  installCommand?: string;
  exportName?: string;
  guidance?: string;
  subComponents?: Record<string, SubComponentBinding>;
  [key: string]: unknown;
}

export interface FrameworkBinding {
  name: string;
  package?: string;
  installCommand?: string;
  description?: string;
  guidance?: string;
  components?: Record<string, ComponentBinding>;
  [key: string]: unknown;
}

export interface ThemeEntry {
  name: string;
  description?: string;
  overrides: Record<string, string>;
  [key: string]: unknown;
}

export interface BreakpointEntry {
  minWidth: string;
  description?: string;
  [key: string]: unknown;
}

export interface ContainerEntry {
  maxWidth: string;
  description?: string;
  [key: string]: unknown;
}

export interface SpacingScaleConfig {
  baseUnit?: string;
  description?: string;
  [key: string]: unknown;
}

export interface GridConfig {
  columns?: number;
  gutter?: string;
  margin?: string;
  description?: string;
  [key: string]: unknown;
}

export interface LayoutPrimitives {
  breakpoints?: Record<string, BreakpointEntry>;
  grid?: GridConfig;
  containers?: Record<string, ContainerEntry>;
  spacingScale?: SpacingScaleConfig;
  [key: string]: unknown;
}

export interface DspackDocument {
  $schema?: string;
  dspack: string;
  name: string;
  description?: string;
  version?: string;
  metadata?: Metadata;
  tokens?: Record<string, TokenCategory>;
  components?: Record<string, ComponentEntry>;
  patterns?: PatternEntry[];
  antiPatterns?: AntiPatternEntry[];
  frameworkBindings?: Record<string, FrameworkBinding>;
  themes?: Record<string, ThemeEntry>;
  layout?: LayoutPrimitives;
  [key: string]: unknown;
}
