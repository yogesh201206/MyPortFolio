/**
 * Netlify Function: github-contributions
 *
 * Fetches the GitHub contribution calendar for yogesh201206 via
 * the GitHub GraphQL API. The GITHUB_TOKEN env var is read server-side;
 * it is NEVER exposed to the browser.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SETUP (required before this works):
 *   1. Create a GitHub personal access token at:
 *      https://github.com/settings/tokens
 *      Scopes needed: read:user  (classic token)
 *      or: user → read:user      (fine-grained token)
 *
 *   2. Add it as a Netlify environment variable:
 *      Netlify Dashboard → Site settings → Environment variables
 *      Key:   GITHUB_TOKEN
 *      Value: <your token>
 *
 *   3. For LOCAL TESTING use:
 *      netlify dev
 *      Then open: http://localhost:8888/.netlify/functions/github-contributions
 *      (Plain "Live Server" / static file servers do NOT run Netlify Functions.)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Returns JSON:
 *   { totalContributions, weeks, months }
 */

'use strict';

const GH_USER = 'yogesh201206';

const QUERY = `
  query ContributionCalendar($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
              color
            }
          }
          months {
            name
            firstDay
            totalWeeks
          }
        }
      }
    }
  }
`;

// Common response headers
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // allows netlify dev + deployed origin
};

exports.handler = async function (event) {
  // Allow browser preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('[github-contributions] GITHUB_TOKEN is not set in environment variables.');
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: 'GITHUB_TOKEN environment variable is not set.',
        hint: 'Add it in Netlify → Site settings → Environment variables, then re-deploy.',
      }),
    };
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent':    'yogesh-portfolio',
      },
      body: JSON.stringify({
        query:     QUERY,
        variables: { login: GH_USER },
      }),
    });

    // Read body once so we can log it on failure
    const rawBody = await response.text();

    if (!response.ok) {
      console.error(
        `[github-contributions] GitHub API returned ${response.status}:`,
        rawBody,
      );
      return {
        statusCode: response.status,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          error:  `GitHub API responded with ${response.status}`,
          detail: rawBody,
        }),
      };
    }

    const json = JSON.parse(rawBody);

    if (json.errors) {
      console.error('[github-contributions] GraphQL errors:', json.errors);
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'GraphQL errors', detail: json.errors }),
      };
    }

    if (!json.data || !json.data.user) {
      console.error('[github-contributions] Unexpected GraphQL response shape:', json);
      return {
        statusCode: 502,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Unexpected response from GitHub GraphQL API.' }),
      };
    }

    const calendar =
      json.data.user.contributionsCollection.contributionCalendar;

    return {
      statusCode: 200,
      headers: {
        ...JSON_HEADERS,
        'Cache-Control': 'public, max-age=3600', // cache 1 hour on CDN
      },
      body: JSON.stringify({
        totalContributions: calendar.totalContributions,
        weeks:              calendar.weeks,
        months:             calendar.months,
      }),
    };
  } catch (err) {
    console.error('[github-contributions] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error:  'Internal server error',
        detail: err.message,
      }),
    };
  }
};
