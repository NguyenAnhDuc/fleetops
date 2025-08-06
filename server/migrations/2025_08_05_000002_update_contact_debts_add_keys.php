<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('contact_debts', function (Blueprint $table) {
            if (!Schema::hasColumn('contact_debts', '_key')) {
                $table->string('_key')->nullable()->after('id');
            }

            if (!Schema::hasColumn('contact_debts', 'uuid')) {
                $table->string('uuid', 191)->nullable()->index()->after('_key');
            }

            if (!Schema::hasColumn('contact_debts', 'public_id')) {
                $table->string('public_id', 191)->nullable()->unique()->after('uuid');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contact_debts', function (Blueprint $table) {
            if (Schema::hasColumn('contact_debts', '_key')) {
                $table->dropColumn('_key');
            }

            if (Schema::hasColumn('contact_debts', 'uuid')) {
                $table->dropColumn('uuid');
            }

            if (Schema::hasColumn('contact_debts', 'public_id')) {
                $table->dropColumn('public_id');
            }
        });
    }
};
