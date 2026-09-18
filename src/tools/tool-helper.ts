import { tool } from 'ai';
import { z } from 'zod';

export type ToolDef<TParams extends z.ZodTypeAny> = {
  description: string;
  parameters: TParams;
  execute: (input: z.infer<TParams>) => Promise<any>;
};

export function defineTool<TParams extends z.ZodTypeAny>(def: ToolDef<TParams>): any {
  return tool({
    description: def.description,
    parameters: def.parameters,
    execute: def.execute,
  } as any);
}
