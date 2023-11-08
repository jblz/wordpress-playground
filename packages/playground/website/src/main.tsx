import { createRoot } from 'react-dom/client';
import PlaygroundViewport from './components/playground-viewport';
import ExportButton from './components/export-button';
import ImportButton from './components/import-button';
import './styles.css';

import { makeBlueprint } from './lib/make-blueprint';
import type { Blueprint } from '@wp-playground/blueprints';
import PlaygroundConfigurationGroup from './components/playground-configuration-group';
import { PlaygroundConfiguration } from './components/playground-configuration-group/form';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { StorageType, StorageTypes } from './types';
import GitHubButton from './components/github-button';

const query = new URL(document.location.href).searchParams;

/*
 * Support passing blueprints in the URI fragment, e.g.:
 * /#{"landingPage": "/?p=4"}
 */
const fragment = decodeURI(document.location.hash || '#').substring(1);
let blueprint: Blueprint;
try {
	blueprint = JSON.parse(fragment);
	// Allow overriding the preferred versions using query params
	// generated by the version switchers.
	if (query.get('php') || query.get('wp')) {
		if (!blueprint.preferredVersions) {
			blueprint.preferredVersions = {} as any;
		}
		blueprint.preferredVersions!.php =
			(query.get('php') as any) ||
			blueprint.preferredVersions!.php ||
			'8.0';
		blueprint.preferredVersions!.wp =
			query.get('wp') || blueprint.preferredVersions!.wp || 'latest';
	}
} catch (e) {
	blueprint = makeBlueprint({
		php: query.get('php') || '8.0',
		wp: query.get('wp') || 'latest',
		theme: query.get('theme') || undefined,
		plugins: query.getAll('plugin'),
		landingPage: query.get('url') || undefined,
		phpExtensionBundles: query.getAll('php-extension-bundle') || [],
	});
}

// @ts-ignore
const opfsSupported = typeof navigator?.storage?.getDirectory !== 'undefined';
let storageRaw = query.get('storage');
if (StorageTypes.includes(storageRaw as any) && !opfsSupported) {
	storageRaw = 'none';
} else if (!StorageTypes.includes(storageRaw as any)) {
	storageRaw = 'none';
}
const storage = storageRaw as StorageType;

const isSeamless = (query.get('mode') || 'browser') === 'seamless';

const currentConfiguration: PlaygroundConfiguration = {
	wp: blueprint.preferredVersions?.wp || 'latest',
	php: resolveVersion(blueprint.preferredVersions?.php, SupportedPHPVersions),
	storage: storage || 'none',
	withExtensions: blueprint.phpExtensionBundles?.[0] === 'kitchen-sink',
};

/*
 * The 6.3 release includes a caching bug where
 * registered styles aren't enqueued when they
 * should be. This isn't present in all environments
 * but it does here in the Playground. For now,
 * the fix is to define `WP_DEVELOPMENT_MODE = all`
 * to bypass the style cache.
 *
 * @see https://core.trac.wordpress.org/ticket/59056
 */
if (currentConfiguration.wp === '6.3') {
	blueprint.steps?.unshift({
		step: 'defineWpConfigConsts',
		consts: {
			WP_DEVELOPMENT_MODE: 'all',
		},
		virtualize: true,
	});
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		storage={storage}
		isSeamless={isSeamless}
		blueprint={blueprint}
		toolbarButtons={[
			<PlaygroundConfigurationGroup
				key="configuration"
				initialConfiguration={currentConfiguration}
			/>,
			<ImportButton key="import" />,
			<ExportButton key="export" />,
			<GitHubButton key="github" />,
		]}
	/>
);

function resolveVersion<T>(
	version: string | undefined,
	allVersions: readonly T[],
	defaultVersion: T = allVersions[0]
): T {
	if (
		!version ||
		!allVersions.includes(version as any) ||
		version === 'latest'
	) {
		return defaultVersion;
	}
	return version as T;
}
