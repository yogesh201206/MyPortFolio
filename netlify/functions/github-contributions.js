/**
 * Netlify Function: github-contributions
 *
 * Fetches the GitHub contribution calendar for yogesh201206 via
 * GitHub GraphQL API. The GITHUB_TOKEN env var is read server-side;
 * it is never exposed to the browser.
 *
 * Required Netlify environment variable:
 *   GITHUB_TOKEN  — a GitHub personal access token with read:user scope
 *
 * Returns JSON:
 *   { totalContributions, weeks, months }
 */

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

exports.handler = async function (event, context) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GITHUB_TOKEN environment variable is not set.' }),
    };
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'yogesh-portfolio',
      },
      body: JSON.stringify({ query: QUERY, variables: { login: GH_USER } }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `GitHub API responded with ${response.status}`, detail: text }),
      };
    }

    const json = await response.json();

    if (json.errors) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'GraphQL errors', detail: json.errors }),
      };
    }

    const calendar =
      json.data.user.contributionsCollection.contributionCalendar;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // cache 1 hour
      },
      body: JSON.stringify({
        totalContributions: calendar.totalContributions,
        weeks:              calendar.weeks,
        months:             calendar.months,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', detail: err.message }),
    };
  }
};
