/**
 * One constant, in its own module.
 *
 * It lives here rather than in `lib/site-content.ts` because that module talks to
 * the database: importing it from a client component (the footer) pulled `pg`
 * into the browser bundle and the whole site returned 500 with
 * "Module not found: Can't resolve 'fs'". A mailto link is not worth a database
 * driver in the browser.
 */
export const STUDIO_EMAIL = "hello@snehavrinda.in";
