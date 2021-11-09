# frozen_string_literal: true

module Script
  module Errors
    class InvalidScriptNameError < ScriptProjectError; end

    class NoExistingAppsError < ScriptProjectError; end
    class NoExistingOrganizationsError < ScriptProjectError; end
  end
end
