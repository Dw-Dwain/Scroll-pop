<?php
/**
 * Admin Settings Page Registration
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class ScrollPop_Admin {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'add_settings_page' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
    }

    public function add_settings_page(): void {
        add_options_page(
            __( 'ScrollPop Settings', 'scrollpop' ),
            __( 'ScrollPop', 'scrollpop' ),
            'manage_options',
            'scrollpop',
            [ $this, 'render_settings_page' ]
        );
    }

    public function register_settings(): void {
        register_setting( 'scrollpop_settings', 'scrollpop_public_key', [
            'type'              => 'string',
            'sanitize_callback' => [ $this, 'sanitize_public_key' ],
            'default'           => '',
        ] );

        register_setting( 'scrollpop_settings', 'scrollpop_enabled', [
            'type'              => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
            'default'           => true,
        ] );

        add_settings_section(
            'scrollpop_general_section',
            __( 'General Settings', 'scrollpop' ),
            null,
            'scrollpop'
        );

        add_settings_field(
            'scrollpop_public_key',
            __( 'Site Public Key', 'scrollpop' ),
            [ $this, 'render_public_key_field' ],
            'scrollpop',
            'scrollpop_general_section'
        );

        add_settings_field(
            'scrollpop_enabled',
            __( 'Enable ScrollPop', 'scrollpop' ),
            [ $this, 'render_enabled_field' ],
            'scrollpop',
            'scrollpop_general_section'
        );
    }

    public function sanitize_public_key( $value ): string {
        $value = sanitize_text_field( $value );
        $value = trim( strtolower( $value ) );
        // Enforce 32 characters hex format
        if ( ! empty( $value ) && ! preg_match( '/^[a-f0-9]{32}$/', $value ) ) {
            add_settings_error(
                'scrollpop_public_key',
                'invalid_public_key',
                __( 'Error: Public Key must be exactly a 32-character hexadecimal string.', 'scrollpop' ),
                'error'
            );
        }
        return $value;
    }

    public function render_public_key_field(): void {
        $key = ScrollPop::get_public_key();
        ?>
        <input type="text" name="scrollpop_public_key" value="<?php echo esc_attr( $key ); ?>" class="regular-text code" placeholder="e.g. 5f4dcc3b5aa765d61d8327deb882cf99" />
        <p class="description"><?php esc_html_e( 'Copy your site\'s Public Key from the ScrollPop Dashboard settings page.', 'scrollpop' ); ?></p>
        <?php
    }

    public function render_enabled_field(): void {
        $enabled = ScrollPop::is_enabled();
        ?>
        <label>
            <input type="checkbox" name="scrollpop_enabled" value="1" <?php checked( $enabled, true ); ?> />
            <?php esc_html_e( 'Deliver popup campaigns to visitors on this WordPress site.', 'scrollpop' ); ?>
        </label>
        <?php
    }

    public function render_settings_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        $public_key  = ScrollPop::get_public_key();
        $enabled     = ScrollPop::is_enabled();
        $status_url  = get_rest_url( null, 'scrollpop/v1/status' );
        $dashboard   = 'https://app.scrollpop.io';
        ?>
        <div class="wrap" style="max-width:760px;">
            <h1 style="display:flex;align-items:center;gap:10px;">
                <?php echo esc_html( get_admin_page_title() ); ?>
                <?php if ( $enabled && ! empty( $public_key ) ) : ?>
                    <span style="font-size:12px;background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:20px;font-weight:500;">● Active</span>
                <?php elseif ( empty( $public_key ) ) : ?>
                    <span style="font-size:12px;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:20px;font-weight:500;">⚠ Setup Required</span>
                <?php endif; ?>
            </h1>

            <p style="color:#555;font-size:14px;max-width:560px;">
                <?php esc_html_e( 'Connect this WordPress site to your ScrollPop account to deliver Google-compliant scroll-triggered popup campaigns.', 'scrollpop' ); ?>
            </p>

            <?php if ( empty( $public_key ) ) : ?>
            <div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:6px;padding:14px 16px;margin:16px 0;font-size:13px;color:#78350f;">
                <strong>📋 Setup Steps:</strong>
                <ol style="margin:8px 0 0 18px;line-height:1.8;">
                    <li>Log in to your <a href="<?php echo esc_url( $dashboard ); ?>" target="_blank">ScrollPop Dashboard</a></li>
                    <li>Go to <strong>Sites → + New Site</strong> and add this WordPress domain</li>
                    <li>Copy your <strong>Site Public Key</strong> from the site card</li>
                    <li>Paste it in the field below and click <strong>Save Changes</strong></li>
                    <li>Return to your dashboard and click <strong>Verify Connection</strong></li>
                </ol>
            </div>
            <?php endif; ?>

            <form action="options.php" method="post">
                <?php
                settings_fields( 'scrollpop_settings' );
                do_settings_sections( 'scrollpop' );
                submit_button( __( 'Save Changes', 'scrollpop' ) );
                ?>
            </form>

            <?php if ( ! empty( $public_key ) ) : ?>
            <hr style="margin:24px 0;" />
            <h2 style="font-size:15px;"><?php esc_html_e( 'Connection Status', 'scrollpop' ); ?></h2>
            <table class="widefat" style="max-width:480px;">
                <tbody>
                    <tr>
                        <th style="width:180px;"><?php esc_html_e( 'Public Key', 'scrollpop' ); ?></th>
                        <td><code><?php echo esc_html( $public_key ); ?></code></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Site URL', 'scrollpop' ); ?></th>
                        <td><?php echo esc_html( get_site_url() ); ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Plugin Version', 'scrollpop' ); ?></th>
                        <td><?php echo esc_html( SCROLLPOP_VERSION ); ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Status Endpoint', 'scrollpop' ); ?></th>
                        <td><a href="<?php echo esc_url( $status_url ); ?>" target="_blank"><?php echo esc_html( $status_url ); ?></a></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Snippet Active', 'scrollpop' ); ?></th>
                        <td><?php echo $enabled ? '<span style="color:#16a34a;">✓ Yes</span>' : '<span style="color:#dc2626;">✗ Disabled</span>'; ?></td>
                    </tr>
                </tbody>
            </table>

            <p style="margin-top:16px;">
                <a href="<?php echo esc_url( $dashboard . '/sites' ); ?>" class="button button-secondary" target="_blank">
                    <?php esc_html_e( 'Open ScrollPop Dashboard →', 'scrollpop' ); ?>
                </a>
            </p>
            <?php endif; ?>
        </div>
        <?php
    }
}
