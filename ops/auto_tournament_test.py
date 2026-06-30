import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).resolve().parent / 'auto-tournament.py'
spec = importlib.util.spec_from_file_location('auto_tournament', MODULE_PATH)
auto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auto)


class AutoTournamentTests(unittest.TestCase):
    def test_normalize_title_matches_case_punctuation_and_filler_words(self):
        self.assertEqual(auto.normalize_title('Best Studio Ghibli Films'), auto.normalize_title('best studio ghibli films!'))
        self.assertEqual(auto.normalize_title('Greatest Rap Albums Ever'), auto.normalize_title('greatest rap albums'))

    def test_available_theme_filters_against_normalized_existing_titles(self):
        themes = ['Best Studio Ghibli films', 'Greatest Soccer Midfielders']
        existing = {'best studio ghibli films'}
        self.assertEqual(auto.available_themes(themes, existing), ['Greatest Soccer Midfielders'])

    def test_should_skip_generated_duplicate_title(self):
        existing = {'most beautiful cities in europe'}
        self.assertTrue(auto.is_duplicate_title('Most Beautiful Cities in Europe', existing))
        self.assertFalse(auto.is_duplicate_title('Best Sandwiches in the World', existing))


if __name__ == '__main__':
    unittest.main()
