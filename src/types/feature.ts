export interface Feature {
  id: string;
  title: string;
  category: "foundation" | "core" | "enhancement" | "nice-to-have";
  description: string;
  acceptance_criteria: string[];
  priority: number;
  depends_on: string[];
  passes: boolean;
  skipped?: boolean;
  source_issue?: number;
}

export interface FeaturesFile {
  features: Feature[];
}
