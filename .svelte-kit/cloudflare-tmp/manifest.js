export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.D9SCBIvf.js",app:"_app/immutable/entry/app.L_50sM9f.js",imports:["_app/immutable/entry/start.D9SCBIvf.js","_app/immutable/chunks/CdNx0Iin.js","_app/immutable/chunks/VxMAg-e4.js","_app/immutable/chunks/Dk6JNuLG.js","_app/immutable/entry/app.L_50sM9f.js","_app/immutable/chunks/VxMAg-e4.js","_app/immutable/chunks/BbDRxRWP.js","_app/immutable/chunks/UyuxbCjR.js","_app/immutable/chunks/0dJBYdp7.js","_app/immutable/chunks/DhrC9RNW.js","_app/immutable/chunks/Dk6JNuLG.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('../output/server/nodes/0.js')),
			__memo(() => import('../output/server/nodes/1.js')),
			__memo(() => import('../output/server/nodes/2.js')),
			__memo(() => import('../output/server/nodes/3.js')),
			__memo(() => import('../output/server/nodes/4.js')),
			__memo(() => import('../output/server/nodes/5.js')),
			__memo(() => import('../output/server/nodes/6.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/agents",
				pattern: /^\/agents\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/agents/orchestrate",
				pattern: /^\/api\/agents\/orchestrate\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('../output/server/entries/endpoints/api/agents/orchestrate/_server.ts.js'))
			},
			{
				id: "/api/pipeline/[id]",
				pattern: /^\/api\/pipeline\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('../output/server/entries/endpoints/api/pipeline/_id_/_server.ts.js'))
			},
			{
				id: "/api/research",
				pattern: /^\/api\/research\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('../output/server/entries/endpoints/api/research/_server.ts.js'))
			},
			{
				id: "/api/status",
				pattern: /^\/api\/status\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('../output/server/entries/endpoints/api/status/_server.ts.js'))
			},
			{
				id: "/config",
				pattern: /^\/config\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/dashboard",
				pattern: /^\/dashboard\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/research/[id]",
				pattern: /^\/research\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

export const prerendered = new Set([]);

export const base_path = "";
