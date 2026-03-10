import type {
	VariableLeafNode,
	VariableSourceNode,
	VariableNodeType,
} from "@/lib/workflow/graph-utils";

export type {
	VariableNodeType as VariableType,
	VariableLeafNode as VariableNode,
	VariableSourceNode,
};

export interface VariablePickerProps {
	nodes: VariableSourceNode[];
	onSelect: (variable: VariableLeafNode, node: VariableSourceNode) => void;
	searchPlaceholder?: string;
	className?: string;
	defaultExpanded?: boolean;
}
