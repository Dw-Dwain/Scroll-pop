<?php
/**
 * Core ScrollPop class — singleton bootstrap
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class ScrollPop {

    private static ?ScrollPop $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
            self::$instance->init();
        }
        return self::$instance;
    }

    private function __construct() {}

    private function init(): void {
        // Load admin settings page
        if ( is_admin() ) {
            new ScrollPop_Admin();
        }

        // Inject snippet on front-end
        $snippet = new ScrollPop_Snippet();
        $snippet->init();

        // Register REST API endpoints (used by ScrollPop Dashboard to verify connection)
        add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );

        // Register activation/deactivation hooks
        register_activation_hook( SCROLLPOP_PLUGIN_FILE, [ $this, 'activate' ] );
        register_deactivation_hook( SCROLLPOP_PLUGIN_FILE, [ $this, 'deactivate' ] );
        register_uninstall_hook( SCROLLPOP_PLUGIN_FILE, [ 'ScrollPop', 'uninstall' ] );
    }

    /**
     * Register REST API routes for the ScrollPop dashboard connection verification.
     * Endpoint: GET /wp-json/scrollpop/v1/status
     */
    public function register_rest_routes(): void {
        register_rest_route( 'scrollpop/v1', '/status', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'rest_status_callback' ],
            'permission_callback' => '__return_true', // Public — key is opaque, not a secret
        ] );
    }

    /**
     * REST callback: returns plugin status + public key for dashboard verification.
     */
    public function rest_status_callback( \WP_REST_Request $request ): \WP_REST_Response {
        $public_key = self::get_public_key();
        $enabled    = self::is_enabled();

        return new \WP_REST_Response( [
            'status'      => 'ok',
            'plugin'      => 'scrollpop',
            'version'     => SCROLLPOP_VERSION,
            'public_key'  => $public_key,
            'enabled'     => $enabled,
            'site_url'    => get_site_url(),
            'site_name'   => get_bloginfo( 'name' ),
        ], 200 );
    }

    public function activate(): void {
        // Nothing to do on activation — settings stored in wp_options
    }

    public function deactivate(): void {
        // Nothing to do on deactivation
    }

    public static function uninstall(): void {
        delete_option( 'scrollpop_public_key' );
        delete_option( 'scrollpop_enabled' );
    }

    /**
     * Get the configured public key (empty string if not set)
     */
    public static function get_public_key(): string {
        return sanitize_text_field( get_option( 'scrollpop_public_key', '' ) );
    }

    /**
     * Is ScrollPop enabled?
     */
    public static function is_enabled(): bool {
        return (bool) get_option( 'scrollpop_enabled', true );
    }
}
