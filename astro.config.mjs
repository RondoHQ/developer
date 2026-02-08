import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	site: 'https://developer.rondo.club',
	integrations: [
		starlight({
			title: 'Rondo Developer',
			logo: {
				src: './src/assets/logo.png',
				replacesTitle: true,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/RondoHQ' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Overview', slug: 'overview' },
						{ label: 'Architecture', slug: 'architecture' },
						{ label: 'Data Model', slug: 'data-model' },
					],
				},
				{
					label: 'Rondo Club API',
					items: [
						{ label: 'API Overview', slug: 'api/rest-api' },
						{ label: 'People (Leden)', slug: 'api/people' },
						{ label: 'Teams', slug: 'api/teams' },
						{ label: 'Committees', slug: 'api/committees' },
						{ label: 'Custom Fields', slug: 'api/custom-fields' },
						{ label: 'VOG Filtered People', slug: 'api/vog-filtered-people' },
						{ label: 'Public Endpoints', slug: 'api/public-endpoints' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'Access Control', slug: 'features/access-control' },
						{ label: 'Multi-User System', slug: 'features/multi-user' },
						{ label: 'Relationships', slug: 'features/relationships' },
						{ label: 'Relationship Types', slug: 'features/relationship-types' },
						{ label: 'Membership Fees', slug: 'features/membership-fees' },
						{ label: 'Reminders', slug: 'features/reminders' },
					],
				},
				{
					label: 'Integrations',
					items: [
						{ label: 'CardDAV Sync', slug: 'integrations/carddav' },
						{ label: 'iCal Feed', slug: 'integrations/ical-feed' },
						{ label: 'Contact Import', slug: 'integrations/import' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Frontend', slug: 'architecture/frontend' },
						{ label: 'PHP Autoloading', slug: 'architecture/php-autoloading' },
						{ label: 'Relationship System', slug: 'architecture/relationship-system' },
					],
				},
				{
					label: 'Rondo Sync',
					items: [
						{ label: 'Sync Architecture', slug: 'sync/architecture' },
						{ label: 'Database Schema', slug: 'sync/database-schema' },
						{ label: 'People Pipeline', slug: 'sync/pipeline-people' },
						{ label: 'Teams Pipeline', slug: 'sync/pipeline-teams' },
						{ label: 'Functions Pipeline', slug: 'sync/pipeline-functions' },
						{ label: 'Nikki Pipeline', slug: 'sync/pipeline-nikki' },
						{ label: 'FreeScout Pipeline', slug: 'sync/pipeline-freescout' },
						{ label: 'Discipline Pipeline', slug: 'sync/pipeline-discipline' },
						{ label: 'Reverse Sync', slug: 'sync/reverse-sync' },
					],
				},
			],
			customCss: ['./src/styles/custom.css'],
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.googleapis.com',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.gstatic.com',
						crossorigin: '',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap',
					},
				},
			],
		}),
		sitemap(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
