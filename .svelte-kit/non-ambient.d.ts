
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/agents" | "/api" | "/api/agents" | "/api/agents/orchestrate" | "/api/pipeline" | "/api/pipeline/[id]" | "/api/research" | "/api/status" | "/config" | "/dashboard" | "/research" | "/research/[id]";
		RouteParams(): {
			"/api/pipeline/[id]": { id: string };
			"/research/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string | undefined };
			"/agents": Record<string, never>;
			"/api": { id?: string | undefined };
			"/api/agents": Record<string, never>;
			"/api/agents/orchestrate": Record<string, never>;
			"/api/pipeline": { id?: string | undefined };
			"/api/pipeline/[id]": { id: string };
			"/api/research": Record<string, never>;
			"/api/status": Record<string, never>;
			"/config": Record<string, never>;
			"/dashboard": Record<string, never>;
			"/research": { id?: string | undefined };
			"/research/[id]": { id: string }
		};
		Pathname(): "/" | "/agents" | "/api/agents/orchestrate" | `/api/pipeline/${string}` & {} | "/api/research" | "/api/status" | "/config" | "/dashboard" | `/research/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}