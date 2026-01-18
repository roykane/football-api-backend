/**
 * Comprehensive mapping of 300+ allowed competitions worldwide
 * Synced with frontend competitions.ts configuration
 *
 * Each competition maps to API-Sports league IDs
 * This allows the worker to only cache matches from competitions we actually display
 */

const ALLOWED_COMPETITIONS = [
  // ============================================
  // VIETNAM
  // ============================================
  { name: 'V.League 1', country: 'Vietnam', leagueId: 340, slug: 'v-league-1' },
  { name: 'V.League 2', country: 'Vietnam', leagueId: 341, slug: 'v-league-2' },
  { name: 'Cúp Quốc Gia', country: 'Vietnam', leagueId: 342, slug: 'cup-quoc-gia' },

  // ============================================
  // ENGLAND
  // ============================================
  { name: 'Premier League', country: 'England', leagueId: 39, slug: 'premier-league' },
  { name: 'Championship', country: 'England', leagueId: 40, slug: 'championship' },
  { name: 'League One', country: 'England', leagueId: 41, slug: 'league-one' },
  { name: 'League Two', country: 'England', leagueId: 42, slug: 'league-two' },
  { name: 'National League', country: 'England', leagueId: 43, slug: 'national-league' },
  { name: 'FA Cup', country: 'England', leagueId: 45, slug: 'fa-cup' },
  { name: 'League Cup', country: 'England', leagueId: 48, slug: 'league-cup' },
  { name: 'EFL Trophy', country: 'England', leagueId: 46, slug: 'efl-trophy' },
  { name: 'FA Trophy', country: 'England', leagueId: 47, slug: 'fa-trophy' },
  { name: 'Community Shield', country: 'England', leagueId: 528, slug: 'community-shield' },

  // ============================================
  // SPAIN
  // ============================================
  { name: 'La Liga', country: 'Spain', leagueId: 140, slug: 'la-liga' },
  { name: 'Segunda División', country: 'Spain', leagueId: 141, slug: 'segunda-division' },
  { name: 'Copa del Rey', country: 'Spain', leagueId: 143, slug: 'copa-del-rey' },
  { name: 'Segunda B - Group 1', country: 'Spain', leagueId: 520, slug: 'segunda-b-group-1' },
  { name: 'Supercopa', country: 'Spain', leagueId: 556, slug: 'supercopa' },

  // ============================================
  // GERMANY
  // ============================================
  { name: 'Bundesliga', country: 'Germany', leagueId: 78, slug: 'bundesliga' },
  { name: '2. Bundesliga', country: 'Germany', leagueId: 79, slug: '2-bundesliga' },
  { name: '3. Liga', country: 'Germany', leagueId: 80, slug: '3-liga' },
  { name: 'DFB Pokal', country: 'Germany', leagueId: 81, slug: 'dfb-pokal' },
  { name: 'DFL Supercup', country: 'Germany', leagueId: 529, slug: 'dfl-supercup' },
  { name: 'Regionalliga - Bayern', country: 'Germany', leagueId: 82, slug: 'regionalliga-bayern' },

  // ============================================
  // FRANCE
  // ============================================
  { name: 'Ligue 1', country: 'France', leagueId: 61, slug: 'ligue-1' },
  { name: 'Ligue 2', country: 'France', leagueId: 62, slug: 'ligue-2' },
  { name: 'National', country: 'France', leagueId: 63, slug: 'national' },
  { name: 'Coupe de France', country: 'France', leagueId: 66, slug: 'coupe-de-france' },
  { name: 'Coupe de la Ligue', country: 'France', leagueId: 65, slug: 'coupe-de-la-ligue' },
  { name: 'Trophée des Champions', country: 'France', leagueId: 527, slug: 'trophee-des-champions' },

  // ============================================
  // ITALY
  // ============================================
  { name: 'Serie A', country: 'Italy', leagueId: 135, slug: 'serie-a' },
  { name: 'Serie B', country: 'Italy', leagueId: 136, slug: 'serie-b' },
  { name: 'Serie C - Group A', country: 'Italy', leagueId: 137, slug: 'serie-c-group-a' },
  { name: 'Coppa Italia', country: 'Italy', leagueId: 137, slug: 'coppa-italia' },
  { name: 'Supercoppa', country: 'Italy', leagueId: 547, slug: 'supercoppa' },

  // ============================================
  // PORTUGAL
  // ============================================
  { name: 'Primeira Liga', country: 'Portugal', leagueId: 94, slug: 'primeira-liga' },
  { name: 'Segunda Liga', country: 'Portugal', leagueId: 96, slug: 'segunda-liga' },
  { name: 'Taça de Portugal', country: 'Portugal', leagueId: 95, slug: 'taca-de-portugal' },
  { name: 'Taça da Liga', country: 'Portugal', leagueId: 97, slug: 'taca-da-liga' },
  { name: 'Supertaça', country: 'Portugal', leagueId: 550, slug: 'supertaca' },

  // ============================================
  // NETHERLANDS
  // ============================================
  { name: 'Eredivisie', country: 'Netherlands', leagueId: 88, slug: 'eredivisie' },
  { name: 'Eerste Divisie', country: 'Netherlands', leagueId: 89, slug: 'eerste-divisie' },
  { name: 'KNVB Beker', country: 'Netherlands', leagueId: 90, slug: 'knvb-beker' },
  { name: 'Johan Cruyff Shield', country: 'Netherlands', leagueId: 544, slug: 'johan-cruyff-shield' },

  // ============================================
  // BELGIUM
  // ============================================
  { name: 'Belgian Pro League', country: 'Belgium', leagueId: 144, slug: 'pro-league' },
  { name: 'Challenger Pro League', country: 'Belgium', leagueId: 145, slug: 'challenger-pro-league' },
  { name: 'Belgian Cup', country: 'Belgium', leagueId: 146, slug: 'belgian-cup' },
  { name: 'Super Cup', country: 'Belgium', leagueId: 532, slug: 'super-cup' },

  // ============================================
  // SCOTLAND
  // ============================================
  { name: 'Premiership', country: 'Scotland', leagueId: 179, slug: 'premiership' },
  { name: 'Championship', country: 'Scotland', leagueId: 180, slug: 'championship' },
  { name: 'League One', country: 'Scotland', leagueId: 181, slug: 'league-one' },
  { name: 'League Two', country: 'Scotland', leagueId: 182, slug: 'league-two' },
  { name: 'FA Cup', country: 'Scotland', leagueId: 183, slug: 'fa-cup' },
  { name: 'League Cup', country: 'Scotland', leagueId: 184, slug: 'league-cup' },

  // ============================================
  // TURKEY
  // ============================================
  { name: 'Süper Lig', country: 'Turkey', leagueId: 203, slug: 'super-lig' },
  { name: '1. Lig', country: 'Turkey', leagueId: 204, slug: '1-lig' },
  { name: 'Turkish Cup', country: 'Turkey', leagueId: 205, slug: 'turkish-cup' },
  { name: 'Super Cup', country: 'Turkey', leagueId: 533, slug: 'super-cup' },

  // ============================================
  // RUSSIA
  // ============================================
  { name: 'Premier League', country: 'Russia', leagueId: 235, slug: 'premier-league' },
  { name: 'FNL', country: 'Russia', leagueId: 236, slug: 'fnl' },
  { name: 'Cup', country: 'Russia', leagueId: 237, slug: 'cup' },

  // ============================================
  // UKRAINE
  // ============================================
  { name: 'Premier League', country: 'Ukraine', leagueId: 333, slug: 'premier-league' },
  { name: 'First League', country: 'Ukraine', leagueId: 334, slug: 'first-league' },
  { name: 'Cup', country: 'Ukraine', leagueId: 335, slug: 'cup' },

  // ============================================
  // POLAND
  // ============================================
  { name: 'Ekstraklasa', country: 'Poland', leagueId: 106, slug: 'ekstraklasa' },
  { name: '1. Liga', country: 'Poland', leagueId: 107, slug: '1-liga' },
  { name: 'Polish Cup', country: 'Poland', leagueId: 108, slug: 'polish-cup' },

  // ============================================
  // DENMARK
  // ============================================
  { name: 'Superliga', country: 'Denmark', leagueId: 119, slug: 'superliga' },
  { name: '1st Division', country: 'Denmark', leagueId: 120, slug: '1st-division' },
  { name: 'DBU Pokalen', country: 'Denmark', leagueId: 121, slug: 'dbu-pokalen' },

  // ============================================
  // SWEDEN
  // ============================================
  { name: 'Allsvenskan', country: 'Sweden', leagueId: 113, slug: 'allsvenskan' },
  { name: 'Superettan', country: 'Sweden', leagueId: 114, slug: 'superettan' },
  { name: 'Svenska Cupen', country: 'Sweden', leagueId: 115, slug: 'svenska-cupen' },
  { name: 'Division 1 - North', country: 'Sweden', leagueId: 116, slug: 'division-1-north' },
  { name: 'Division 1 - South', country: 'Sweden', leagueId: 117, slug: 'division-1-south' },

  // ============================================
  // NORWAY
  // ============================================
  { name: 'Eliteserien', country: 'Norway', leagueId: 103, slug: 'eliteserien' },
  { name: '1. Division', country: 'Norway', leagueId: 104, slug: '1-division' },
  { name: 'NM Cup', country: 'Norway', leagueId: 105, slug: 'nm-cup' },

  // ============================================
  // AUSTRIA
  // ============================================
  { name: 'Bundesliga', country: 'Austria', leagueId: 218, slug: 'bundesliga' },
  { name: '2. Liga', country: 'Austria', leagueId: 219, slug: '2-liga' },
  { name: 'ÖFB Cup', country: 'Austria', leagueId: 220, slug: 'ofb-cup' },

  // ============================================
  // SWITZERLAND
  // ============================================
  { name: 'Super League', country: 'Switzerland', leagueId: 207, slug: 'super-league' },
  { name: 'Challenge League', country: 'Switzerland', leagueId: 208, slug: 'challenge-league' },
  { name: 'Swiss Cup', country: 'Switzerland', leagueId: 209, slug: 'swiss-cup' },

  // ============================================
  // CZECH REPUBLIC
  // ============================================
  { name: 'Czech Liga', country: 'Czech Republic', leagueId: 345, slug: 'czech-liga' },
  { name: 'FNL', country: 'Czech Republic', leagueId: 346, slug: 'fnl' },
  { name: 'MOL Cup', country: 'Czech Republic', leagueId: 347, slug: 'mol-cup' },

  // ============================================
  // GREECE
  // ============================================
  { name: 'Super League', country: 'Greece', leagueId: 197, slug: 'super-league' },
  { name: 'Super League 2', country: 'Greece', leagueId: 198, slug: 'super-league-2' },
  { name: 'Greek Cup', country: 'Greece', leagueId: 199, slug: 'greek-cup' },

  // ============================================
  // CROATIA
  // ============================================
  { name: 'HNL', country: 'Croatia', leagueId: 210, slug: 'hnl' },
  { name: 'Prva NL', country: 'Croatia', leagueId: 211, slug: 'prva-nl' },
  { name: 'Croatian Cup', country: 'Croatia', leagueId: 212, slug: 'croatian-cup' },

  // ============================================
  // SERBIA
  // ============================================
  { name: 'Super Liga', country: 'Serbia', leagueId: 286, slug: 'super-liga' },
  { name: 'Prva Liga', country: 'Serbia', leagueId: 287, slug: 'prva-liga' },
  { name: 'Serbian Cup', country: 'Serbia', leagueId: 288, slug: 'serbian-cup' },

  // ============================================
  // ROMANIA
  // ============================================
  { name: 'Liga I', country: 'Romania', leagueId: 283, slug: 'liga-i' },
  { name: 'Liga II', country: 'Romania', leagueId: 284, slug: 'liga-ii' },
  { name: 'Romanian Cup', country: 'Romania', leagueId: 285, slug: 'romanian-cup' },

  // ============================================
  // BULGARIA
  // ============================================
  { name: 'First League', country: 'Bulgaria', leagueId: 172, slug: 'first-league' },
  { name: 'Second League', country: 'Bulgaria', leagueId: 173, slug: 'second-league' },
  { name: 'Bulgarian Cup', country: 'Bulgaria', leagueId: 174, slug: 'bulgarian-cup' },

  // ============================================
  // CYPRUS
  // ============================================
  { name: '1. Division', country: 'Cyprus', leagueId: 318, slug: '1-division' },
  { name: '2. Division', country: 'Cyprus', leagueId: 319, slug: '2-division' },
  { name: '3. Division', country: 'Cyprus', leagueId: 320, slug: '3-division' },
  { name: 'Cup', country: 'Cyprus', leagueId: 321, slug: 'cup' },

  // ============================================
  // ISRAEL
  // ============================================
  { name: 'Ligat Ha\'al', country: 'Israel', leagueId: 383, slug: 'ligat-haal' },
  { name: 'Liga Leumit', country: 'Israel', leagueId: 384, slug: 'liga-leumit' },
  { name: 'State Cup', country: 'Israel', leagueId: 385, slug: 'state-cup' },

  // ============================================
  // ICELAND
  // ============================================
  { name: 'Besta deild karla', country: 'Iceland', leagueId: 164, slug: 'besta-deild-karla' },
  { name: '1. deild', country: 'Iceland', leagueId: 165, slug: '1-deild' },
  { name: 'Iceland Cup', country: 'Iceland', leagueId: 166, slug: 'iceland-cup' },

  // ============================================
  // FINLAND
  // ============================================
  { name: 'Veikkausliiga', country: 'Finland', leagueId: 244, slug: 'veikkausliiga' },
  { name: 'Ykkonen', country: 'Finland', leagueId: 245, slug: 'ykkonen' },
  { name: 'Finnish Cup', country: 'Finland', leagueId: 246, slug: 'finnish-cup' },

  // ============================================
  // REPUBLIC OF IRELAND
  // ============================================
  { name: 'Premier Division', country: 'Republic of Ireland', leagueId: 357, slug: 'premier-division' },
  { name: 'First Division', country: 'Republic of Ireland', leagueId: 358, slug: 'first-division' },
  { name: 'FAI Cup', country: 'Republic of Ireland', leagueId: 359, slug: 'fai-cup' },

  // ============================================
  // WALES
  // ============================================
  { name: 'Premier League', country: 'Wales', leagueId: 180, slug: 'premier-league' },
  { name: 'Welsh Cup', country: 'Wales', leagueId: 181, slug: 'welsh-cup' },

  // ============================================
  // NORTHERN IRELAND
  // ============================================
  { name: 'Premiership', country: 'Northern Ireland', leagueId: 185, slug: 'premiership' },
  { name: 'Championship', country: 'Northern Ireland', leagueId: 186, slug: 'championship' },
  { name: 'Irish Cup', country: 'Northern Ireland', leagueId: 187, slug: 'irish-cup' },

  // ============================================
  // HUNGARY
  // ============================================
  { name: 'NB I', country: 'Hungary', leagueId: 271, slug: 'nb-i' },
  { name: 'NB II', country: 'Hungary', leagueId: 272, slug: 'nb-ii' },
  { name: 'Magyar Kupa', country: 'Hungary', leagueId: 273, slug: 'magyar-kupa' },

  // ============================================
  // SLOVAKIA
  // ============================================
  { name: 'Super Liga', country: 'Slovakia', leagueId: 332, slug: 'super-liga' },
  { name: '2. Liga', country: 'Slovakia', leagueId: 333, slug: '2-liga' },
  { name: 'Slovak Cup', country: 'Slovakia', leagueId: 334, slug: 'slovak-cup' },

  // ============================================
  // SLOVENIA
  // ============================================
  { name: 'Prva Liga', country: 'Slovenia', leagueId: 253, slug: 'prva-liga' },
  { name: '2. SNL', country: 'Slovenia', leagueId: 254, slug: '2-snl' },
  { name: 'Slovenian Cup', country: 'Slovenia', leagueId: 255, slug: 'slovenian-cup' },

  // ============================================
  // BOSNIA AND HERZEGOVINA
  // ============================================
  { name: 'Premier League', country: 'Bosnia and Herzegovina', leagueId: 340, slug: 'premier-league' },
  { name: 'First League', country: 'Bosnia and Herzegovina', leagueId: 341, slug: 'first-league' },

  // ============================================
  // NORTH MACEDONIA
  // ============================================
  { name: 'First League', country: 'North Macedonia', leagueId: 341, slug: 'first-league' },
  { name: 'Second League', country: 'North Macedonia', leagueId: 342, slug: 'second-league' },

  // ============================================
  // ALBANIA
  // ============================================
  { name: 'Superliga', country: 'Albania', leagueId: 363, slug: 'superliga' },
  { name: 'First Division', country: 'Albania', leagueId: 364, slug: 'first-division' },

  // ============================================
  // EUROPE (UEFA COMPETITIONS)
  // ============================================
  { name: 'UEFA Champions League', country: 'Europe', leagueId: 2, slug: 'uefa-champions-league' },
  { name: 'UEFA Europa League', country: 'Europe', leagueId: 3, slug: 'uefa-europa-league' },
  { name: 'UEFA Conference League', country: 'Europe', leagueId: 848, slug: 'uefa-conference-league' },
  { name: 'UEFA Super Cup', country: 'Europe', leagueId: 531, slug: 'uefa-super-cup' },
  { name: 'UEFA Nations League', country: 'Europe', leagueId: 5, slug: 'uefa-nations-league' },
  { name: 'European Championship', country: 'Europe', leagueId: 4, slug: 'european-championship' },
  { name: 'European Championship - Qualification', country: 'Europe', leagueId: 960, slug: 'euro-qualification' },
  { name: 'UEFA Youth League', country: 'Europe', leagueId: 6, slug: 'uefa-youth-league' },

  // ============================================
  // JAPAN
  // ============================================
  { name: 'J1 League', country: 'Japan', leagueId: 98, slug: 'j1-league' },
  { name: 'J2 League', country: 'Japan', leagueId: 99, slug: 'j2-league' },
  { name: 'J3 League', country: 'Japan', leagueId: 100, slug: 'j3-league' },
  { name: 'Emperor\'s Cup', country: 'Japan', leagueId: 101, slug: 'emperor-cup' },
  { name: 'J. League Cup', country: 'Japan', leagueId: 102, slug: 'j-league-cup' },

  // ============================================
  // SOUTH KOREA
  // ============================================
  { name: 'K League 1', country: 'South Korea', leagueId: 292, slug: 'k-league-1' },
  { name: 'K League 2', country: 'South Korea', leagueId: 293, slug: 'k-league-2' },
  { name: 'FA Cup', country: 'South Korea', leagueId: 294, slug: 'fa-cup' },
  { name: 'League Cup', country: 'South Korea', leagueId: 295, slug: 'league-cup' },

  // ============================================
  // CHINA
  // ============================================
  { name: 'Chinese Super League', country: 'China', leagueId: 17, slug: 'super-league' },
  { name: 'League One', country: 'China', leagueId: 18, slug: 'league-one' },
  { name: 'FA Cup', country: 'China', leagueId: 19, slug: 'fa-cup' },
  { name: 'CFA Cup', country: 'China', leagueId: 20, slug: 'cfa-cup' },

  // ============================================
  // THAILAND
  // ============================================
  { name: 'Thai League 1', country: 'Thailand', leagueId: 271, slug: 'thai-league-1' },
  { name: 'Thai League 2', country: 'Thailand', leagueId: 272, slug: 'thai-league-2' },
  { name: 'Thai League Cup', country: 'Thailand', leagueId: 565, slug: 'thai-league-cup' },
  { name: 'FA Cup', country: 'Thailand', leagueId: 273, slug: 'fa-cup' },

  // ============================================
  // HONG KONG
  // ============================================
  { name: 'Hong Kong Premier League', country: 'Hong Kong', leagueId: 563, slug: 'premier-league' },
  { name: 'First Division', country: 'Hong Kong', leagueId: 564, slug: 'first-division' },
  { name: 'FA Cup', country: 'Hong Kong', leagueId: 566, slug: 'fa-cup' },
  { name: 'Senior Shield', country: 'Hong Kong', leagueId: 567, slug: 'senior-shield' },
  { name: 'League Cup', country: 'Hong Kong', leagueId: 568, slug: 'league-cup' },

  // ============================================
  // MALAYSIA
  // ============================================
  { name: 'Super League', country: 'Malaysia', leagueId: 268, slug: 'super-league' },
  { name: 'Premier League', country: 'Malaysia', leagueId: 269, slug: 'premier-league' },
  { name: 'FA Cup', country: 'Malaysia', leagueId: 270, slug: 'fa-cup' },

  // ============================================
  // SINGAPORE
  // ============================================
  { name: 'Premier League', country: 'Singapore', leagueId: 265, slug: 'premier-league' },
  { name: 'Cup', country: 'Singapore', leagueId: 266, slug: 'cup' },

  // ============================================
  // INDONESIA
  // ============================================
  { name: 'Liga 1', country: 'Indonesia', leagueId: 274, slug: 'liga-1' },
  { name: 'Liga 2', country: 'Indonesia', leagueId: 275, slug: 'liga-2' },
  { name: 'Piala Indonesia', country: 'Indonesia', leagueId: 276, slug: 'piala-indonesia' },

  // ============================================
  // AUSTRALIA
  // ============================================
  { name: 'A-League', country: 'Australia', leagueId: 188, slug: 'a-league' },
  { name: 'NPL - Victoria', country: 'Australia', leagueId: 189, slug: 'npl-victoria' },
  { name: 'FFA Cup', country: 'Australia', leagueId: 190, slug: 'ffa-cup' },

  // ============================================
  // NEW ZEALAND
  // ============================================
  { name: 'Premiership', country: 'New Zealand', leagueId: 195, slug: 'premiership' },
  { name: 'Championship', country: 'New Zealand', leagueId: 196, slug: 'championship' },

  // ============================================
  // INDIA
  // ============================================
  { name: 'Indian Super League', country: 'India', leagueId: 323, slug: 'indian-super-league' },
  { name: 'I-League', country: 'India', leagueId: 324, slug: 'i-league' },
  { name: 'Super Cup', country: 'India', leagueId: 325, slug: 'super-cup' },

  // ============================================
  // SAUDI ARABIA
  // ============================================
  { name: 'Pro League', country: 'Saudi Arabia', leagueId: 307, slug: 'pro-league' },
  { name: 'First Division', country: 'Saudi Arabia', leagueId: 308, slug: 'first-division' },
  { name: 'Kings Cup', country: 'Saudi Arabia', leagueId: 309, slug: 'kings-cup' },

  // ============================================
  // UAE
  // ============================================
  { name: 'Arabian Gulf League', country: 'UAE', leagueId: 301, slug: 'arabian-gulf-league' },
  { name: 'Division 1', country: 'UAE', leagueId: 302, slug: 'division-1' },
  { name: 'President Cup', country: 'UAE', leagueId: 303, slug: 'president-cup' },

  // ============================================
  // QATAR
  // ============================================
  { name: 'Stars League', country: 'Qatar', leagueId: 305, slug: 'stars-league' },
  { name: 'Second Division', country: 'Qatar', leagueId: 306, slug: 'second-division' },
  { name: 'Qatar Cup', country: 'Qatar', leagueId: 307, slug: 'qatar-cup' },

  // ============================================
  // IRAN
  // ============================================
  { name: 'Persian Gulf Pro League', country: 'Iran', leagueId: 290, slug: 'persian-gulf-pro-league' },
  { name: 'Azadegan League', country: 'Iran', leagueId: 291, slug: 'azadegan-league' },
  { name: 'Hazfi Cup', country: 'Iran', leagueId: 292, slug: 'hazfi-cup' },

  // ============================================
  // IRAQ
  // ============================================
  { name: 'Premier League', country: 'Iraq', leagueId: 316, slug: 'premier-league' },
  { name: 'FA Cup', country: 'Iraq', leagueId: 317, slug: 'fa-cup' },

  // ============================================
  // UZBEKISTAN
  // ============================================
  { name: 'Super League', country: 'Uzbekistan', leagueId: 339, slug: 'super-league' },
  { name: 'First Division', country: 'Uzbekistan', leagueId: 340, slug: 'first-division' },

  // ============================================
  // ASIA (AFC COMPETITIONS)
  // ============================================
  { name: 'AFC Champions League', country: 'Asia', leagueId: 7, slug: 'afc-champions-league' },
  { name: 'AFC Champions League 2', country: 'Asia', leagueId: 1070, slug: 'afc-champions-league-2' },
  { name: 'AFC Cup', country: 'Asia', leagueId: 8, slug: 'afc-cup' },
  { name: 'Asian Cup', country: 'Asia', leagueId: 10, slug: 'asian-cup' },
  { name: 'Asian Cup - Qualification', country: 'Asia', leagueId: 11, slug: 'asian-cup-qualification' },

  // ============================================
  // BRAZIL
  // ============================================
  { name: 'Serie A', country: 'Brazil', leagueId: 71, slug: 'serie-a' },
  { name: 'Serie B', country: 'Brazil', leagueId: 72, slug: 'serie-b' },
  { name: 'Serie C', country: 'Brazil', leagueId: 73, slug: 'serie-c' },
  { name: 'Copa do Brasil', country: 'Brazil', leagueId: 74, slug: 'copa-do-brasil' },
  { name: 'Paulista A1', country: 'Brazil', leagueId: 75, slug: 'paulista-a1' },
  { name: 'Carioca', country: 'Brazil', leagueId: 76, slug: 'carioca' },
  { name: 'Mineiro 1', country: 'Brazil', leagueId: 77, slug: 'mineiro-1' },

  // ============================================
  // ARGENTINA
  // ============================================
  { name: 'Liga Profesional', country: 'Argentina', leagueId: 128, slug: 'liga-profesional' },
  { name: 'Primera B Nacional', country: 'Argentina', leagueId: 129, slug: 'primera-b-nacional' },
  { name: 'Copa Argentina', country: 'Argentina', leagueId: 130, slug: 'copa-argentina' },
  { name: 'Supercopa', country: 'Argentina', leagueId: 131, slug: 'supercopa' },

  // ============================================
  // COLOMBIA
  // ============================================
  { name: 'Primera A', country: 'Colombia', leagueId: 239, slug: 'primera-a' },
  { name: 'Primera B', country: 'Colombia', leagueId: 240, slug: 'primera-b' },
  { name: 'Copa Colombia', country: 'Colombia', leagueId: 241, slug: 'copa-colombia' },

  // ============================================
  // CHILE
  // ============================================
  { name: 'Primera División', country: 'Chile', leagueId: 265, slug: 'primera-division' },
  { name: 'Primera B', country: 'Chile', leagueId: 266, slug: 'primera-b' },
  { name: 'Copa Chile', country: 'Chile', leagueId: 267, slug: 'copa-chile' },

  // ============================================
  // URUGUAY
  // ============================================
  { name: 'Primera División', country: 'Uruguay', leagueId: 269, slug: 'primera-division' },
  { name: 'Segunda División', country: 'Uruguay', leagueId: 270, slug: 'segunda-division' },

  // ============================================
  // PARAGUAY
  // ============================================
  { name: 'Primera División', country: 'Paraguay', leagueId: 250, slug: 'primera-division' },
  { name: 'División Intermedia', country: 'Paraguay', leagueId: 251, slug: 'division-intermedia' },

  // ============================================
  // PERU
  // ============================================
  { name: 'Primera División', country: 'Peru', leagueId: 281, slug: 'primera-division' },
  { name: 'Segunda División', country: 'Peru', leagueId: 282, slug: 'segunda-division' },
  { name: 'Copa Perú', country: 'Peru', leagueId: 283, slug: 'copa-peru' },

  // ============================================
  // ECUADOR
  // ============================================
  { name: 'Primera A', country: 'Ecuador', leagueId: 242, slug: 'primera-a' },
  { name: 'Primera B', country: 'Ecuador', leagueId: 243, slug: 'primera-b' },

  // ============================================
  // BOLIVIA
  // ============================================
  { name: 'Primera División', country: 'Bolivia', leagueId: 233, slug: 'primera-division' },

  // ============================================
  // VENEZUELA
  // ============================================
  { name: 'Primera División', country: 'Venezuela', leagueId: 299, slug: 'primera-division' },
  { name: 'Segunda División', country: 'Venezuela', leagueId: 300, slug: 'segunda-division' },

  // ============================================
  // USA
  // ============================================
  { name: 'Major League Soccer', country: 'USA', leagueId: 253, slug: 'major-league-soccer' },
  { name: 'USL Championship', country: 'USA', leagueId: 255, slug: 'usl-championship' },
  { name: 'USL League One', country: 'USA', leagueId: 256, slug: 'usl-league-one' },
  { name: 'US Open Cup', country: 'USA', leagueId: 257, slug: 'us-open-cup' },

  // ============================================
  // MEXICO
  // ============================================
  { name: 'Liga MX', country: 'Mexico', leagueId: 262, slug: 'liga-mx' },
  { name: 'Liga de Expansión MX', country: 'Mexico', leagueId: 263, slug: 'liga-de-expansion-mx' },
  { name: 'Copa MX', country: 'Mexico', leagueId: 264, slug: 'copa-mx' },

  // ============================================
  // CANADA
  // ============================================
  { name: 'Canadian Premier League', country: 'Canada', leagueId: 296, slug: 'canadian-premier-league' },
  { name: 'Canadian Championship', country: 'Canada', leagueId: 297, slug: 'canadian-championship' },

  // ============================================
  // COSTA RICA
  // ============================================
  { name: 'Primera División', country: 'Costa Rica', leagueId: 159, slug: 'primera-division' },
  { name: 'Liga de Ascenso', country: 'Costa Rica', leagueId: 160, slug: 'liga-de-ascenso' },

  // ============================================
  // SOUTH AMERICA (CONMEBOL)
  // ============================================
  { name: 'Copa Libertadores', country: 'South America', leagueId: 13, slug: 'copa-libertadores' },
  { name: 'Copa Sudamericana', country: 'South America', leagueId: 11, slug: 'copa-sudamericana' },
  { name: 'Recopa Sudamericana', country: 'South America', leagueId: 12, slug: 'recopa-sudamericana' },
  { name: 'Copa America', country: 'South America', leagueId: 9, slug: 'copa-america' },

  // ============================================
  // EGYPT
  // ============================================
  { name: 'Premier League', country: 'Egypt', leagueId: 233, slug: 'premier-league' },
  { name: 'Second League', country: 'Egypt', leagueId: 234, slug: 'second-league' },
  { name: 'Egypt Cup', country: 'Egypt', leagueId: 235, slug: 'egypt-cup' },

  // ============================================
  // SOUTH AFRICA
  // ============================================
  { name: 'Premier Division', country: 'South Africa', leagueId: 288, slug: 'premier-division' },
  { name: 'First Division', country: 'South Africa', leagueId: 289, slug: 'first-division' },
  { name: 'MTN 8 Cup', country: 'South Africa', leagueId: 290, slug: 'mtn-8-cup' },
  { name: 'Nedbank Cup', country: 'South Africa', leagueId: 291, slug: 'nedbank-cup' },

  // ============================================
  // MOROCCO
  // ============================================
  { name: 'Botola Pro', country: 'Morocco', leagueId: 200, slug: 'botola-pro' },
  { name: 'Botola 2', country: 'Morocco', leagueId: 201, slug: 'botola-2' },
  { name: 'Coupe du Trône', country: 'Morocco', leagueId: 202, slug: 'coupe-du-trone' },

  // ============================================
  // ALGERIA
  // ============================================
  { name: 'Ligue 1', country: 'Algeria', leagueId: 191, slug: 'ligue-1' },
  { name: 'Ligue 2', country: 'Algeria', leagueId: 192, slug: 'ligue-2' },
  { name: 'Algerian Cup', country: 'Algeria', leagueId: 193, slug: 'algerian-cup' },

  // ============================================
  // TUNISIA
  // ============================================
  { name: 'Ligue 1', country: 'Tunisia', leagueId: 202, slug: 'ligue-1' },
  { name: 'Ligue 2', country: 'Tunisia', leagueId: 203, slug: 'ligue-2' },
  { name: 'Tunisian Cup', country: 'Tunisia', leagueId: 204, slug: 'tunisian-cup' },

  // ============================================
  // NIGERIA
  // ============================================
  { name: 'NPFL', country: 'Nigeria', leagueId: 278, slug: 'npfl' },
  { name: 'NNL', country: 'Nigeria', leagueId: 279, slug: 'nnl' },

  // ============================================
  // GHANA
  // ============================================
  { name: 'Premier League', country: 'Ghana', leagueId: 272, slug: 'premier-league' },
  { name: 'Division One', country: 'Ghana', leagueId: 273, slug: 'division-one' },

  // ============================================
  // KENYA
  // ============================================
  { name: 'Premier League', country: 'Kenya', leagueId: 274, slug: 'premier-league' },

  // ============================================
  // IVORY COAST
  // ============================================
  { name: 'Ligue 1', country: 'Ivory Coast', leagueId: 354, slug: 'ligue-1' },

  // ============================================
  // SENEGAL
  // ============================================
  { name: 'Ligue 1', country: 'Senegal', leagueId: 287, slug: 'ligue-1' },

  // ============================================
  // CAMEROON
  // ============================================
  { name: 'Elite One', country: 'Cameroon', leagueId: 354, slug: 'elite-one' },

  // ============================================
  // AFRICA (CAF COMPETITIONS)
  // ============================================
  { name: 'CAF Champions League', country: 'Africa', leagueId: 12, slug: 'caf-champions-league' },
  { name: 'CAF Confederation Cup', country: 'Africa', leagueId: 20, slug: 'caf-confederation-cup' },
  { name: 'CAF Super Cup', country: 'Africa', leagueId: 19, slug: 'caf-super-cup' },
  { name: 'Africa Cup of Nations', country: 'Africa', leagueId: 1, slug: 'africa-cup-of-nations' },
  { name: 'Africa Cup of Nations - Qualification', country: 'Africa', leagueId: 2, slug: 'afcon-qualification' },

  // ============================================
  // NORTH & CENTRAL AMERICA (CONCACAF)
  // ============================================
  { name: 'CONCACAF Champions League', country: 'North America', leagueId: 16, slug: 'concacaf-champions-league' },
  { name: 'CONCACAF League', country: 'North America', leagueId: 17, slug: 'concacaf-league' },
  { name: 'Gold Cup', country: 'North America', leagueId: 18, slug: 'gold-cup' },
  { name: 'Nations League', country: 'North America', leagueId: 26, slug: 'nations-league' },

  // ============================================
  // WORLD (FIFA COMPETITIONS)
  // ============================================
  { name: 'FIFA World Cup', country: 'World', leagueId: 1, slug: 'world-cup' },
  { name: 'FIFA World Cup', country: 'World', leagueId: 1, slug: 'fifa-world-cup' },
  { name: 'World Cup - Qualification CONMEBOL', country: 'World', leagueId: 34, slug: 'wc-qualification-conmebol' },
  { name: 'World Cup - Qualification UEFA', country: 'World', leagueId: 32, slug: 'wc-qualification-uefa' },
  { name: 'World Cup - Qualification CONCACAF', country: 'World', leagueId: 33, slug: 'wc-qualification-concacaf' },
  { name: 'World Cup - Qualification AFC', country: 'World', leagueId: 35, slug: 'wc-qualification-afc' },
  { name: 'World Cup - Qualification CAF', country: 'World', leagueId: 36, slug: 'wc-qualification-caf' },
  { name: 'FIFA Club World Cup', country: 'World', leagueId: 15, slug: 'fifa-club-world-cup' },
  { name: 'FIFA U-20 World Cup', country: 'World', leagueId: 21, slug: 'u20-world-cup' },
  { name: 'FIFA U-17 World Cup', country: 'World', leagueId: 22, slug: 'u17-world-cup' },
  { name: 'FIFA Women\'s World Cup', country: 'World', leagueId: 14, slug: 'womens-world-cup' },
];

/**
 * Excluded competitions - these will be filtered out from all displays
 * These are typically friendlies, exhibition matches, or low-priority competitions
 */
const EXCLUDED_COMPETITIONS = [
  { name: 'Friendlies', country: 'World', leagueId: 10, slug: 'friendlies' },
  { name: 'Friendlies Clubs', country: 'World', leagueId: 667, slug: 'friendlies-clubs' },
];

/**
 * Get all excluded league IDs as an array
 */
function getExcludedLeagueIds() {
  return EXCLUDED_COMPETITIONS.map(comp => comp.leagueId);
}

/**
 * Check if a league ID is excluded
 */
function isLeagueExcluded(leagueId) {
  return EXCLUDED_COMPETITIONS.some(comp => comp.leagueId === leagueId);
}

/**
 * Get all allowed league IDs as an array (excluding excluded leagues)
 */
function getAllowedLeagueIds() {
  // Use Set to deduplicate (some leagues appear twice)
  const excludedIds = getExcludedLeagueIds();
  return [...new Set(ALLOWED_COMPETITIONS.map(comp => comp.leagueId))]
    .filter(id => !excludedIds.includes(id));
}

/**
 * Get allowed league IDs as comma-separated string (for API params)
 */
function getAllowedLeagueIdsString() {
  return getAllowedLeagueIds().join(',');
}

/**
 * Check if a league ID is allowed
 */
function isLeagueAllowed(leagueId) {
  return ALLOWED_COMPETITIONS.some(comp => comp.leagueId === leagueId);
}

/**
 * Get competition by league ID
 */
function getCompetitionByLeagueId(leagueId) {
  return ALLOWED_COMPETITIONS.find(comp => comp.leagueId === leagueId) || null;
}

/**
 * Get competition by slug
 */
function getCompetitionBySlug(slug) {
  return ALLOWED_COMPETITIONS.find(comp => comp.slug === slug) || null;
}

/**
 * Get grouped league IDs by priority for HOT matches
 * Returns top-tier leagues first
 */
function getHotLeagueIds() {
  const topTier = [
    39,  // Premier League
    140, // La Liga
    135, // Serie A
    78,  // Bundesliga
    61,  // Ligue 1
    2,   // UEFA Champions League
    3,   // UEFA Europa League
    848, // UEFA Conference League
  ];
  return topTier;
}

/**
 * Get statistics about allowed competitions
 */
function getStats() {
  const total = ALLOWED_COMPETITIONS.length;
  const uniqueLeagues = getAllowedLeagueIds().length;
  const countries = [...new Set(ALLOWED_COMPETITIONS.map(c => c.country))];

  return {
    total: total,
    uniqueLeagues: uniqueLeagues,
    countries: countries.length,
    countryList: countries
  };
}

module.exports = {
  ALLOWED_COMPETITIONS,
  EXCLUDED_COMPETITIONS,
  getAllowedLeagueIds,
  getAllowedLeagueIdsString,
  isLeagueAllowed,
  isLeagueExcluded,
  getExcludedLeagueIds,
  getCompetitionByLeagueId,
  getCompetitionBySlug,
  getHotLeagueIds,
  getStats
};
