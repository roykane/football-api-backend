const axios = require('axios');
require('dotenv').config();

/**
 * Football API wrapper class
 * Provides methods to interact with API-Football API
 */
class FootballApi {
  constructor() {
    this.baseURL = 'https://v3.football.api-sports.io';
    this.apiKey = process.env.API_FOOTBALL_KEY;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-rapidapi-key': this.apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    });
  }

  /**
   * Get fixtures with filters
   * @param {Object} params - Query parameters (id, league, season, from, to, etc.)
   * @returns {Promise<Array>} Array of fixtures
   */
  async getFixtures(params = {}) {
    try {
      const response = await this.client.get('/fixtures', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching fixtures:', error.message);
      throw error;
    }
  }

  /**
   * Get odds for fixtures
   * @param {Object} params - Query parameters (fixture, league, season, bookmaker, etc.)
   * @returns {Promise<Array>} Array of odds data
   */
  async getOdds(params = {}) {
    try {
      const response = await this.client.get('/odds', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching odds:', error.message);
      throw error;
    }
  }

  /**
   * Get leagues
   * @param {Object} params - Query parameters (id, country, season, etc.)
   * @returns {Promise<Array>} Array of leagues
   */
  async getLeagues(params = {}) {
    try {
      const response = await this.client.get('/leagues', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching leagues:', error.message);
      throw error;
    }
  }

  /**
   * Get teams
   * @param {Object} params - Query parameters (id, league, season, etc.)
   * @returns {Promise<Array>} Array of teams
   */
  async getTeams(params = {}) {
    try {
      const response = await this.client.get('/teams', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching teams:', error.message);
      throw error;
    }
  }

  /**
   * Get standings
   * @param {Object} params - Query parameters (league, season, team, etc.)
   * @returns {Promise<Array>} Array of standings
   */
  async getStandings(params = {}) {
    try {
      const response = await this.client.get('/standings', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching standings:', error.message);
      throw error;
    }
  }

  /**
   * Get countries
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Array of countries
   */
  async getCountries(params = {}) {
    try {
      const response = await this.client.get('/countries', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching countries:', error.message);
      throw error;
    }
  }

  /**
   * Get bookmakers
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Array of bookmakers
   */
  async getBookmakers(params = {}) {
    try {
      const response = await this.client.get('/odds/bookmakers', { params });

      if (response.data && response.data.response) {
        return response.data.response;
      }

      return [];
    } catch (error) {
      console.error('[FootballApi] Error fetching bookmakers:', error.message);
      throw error;
    }
  }
}

module.exports = FootballApi;
