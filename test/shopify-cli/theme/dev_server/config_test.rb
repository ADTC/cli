# frozen_string_literal: true
require "test_helper"
require "shopify-cli/theme/dev_server"

class ThemeTest < Minitest::Test
  def test_uses_development_environment_by_default
    config = ShopifyCli::Theme::DevServer::Config.from_path(ShopifyCli::ROOT + "/test/fixtures/theme")

    assert_equal(["config/*_secret.json", "config/more_secrets.json"], config.ignore_files)
  end

  def test_uses_another_environment_if_specified
    config = ShopifyCli::Theme::DevServer::Config.from_path(
      ShopifyCli::ROOT + "/test/fixtures/theme",
      environment: "staging"
    )

    assert_equal(["config/*_secret.json"], config.ignore_files)
  end
end
