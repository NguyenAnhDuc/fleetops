<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up() : void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->integer('fees')->default(0)->after('estimate_date');
            $table->boolean('is_collected_fees')->default(false)->after('fees');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down() : void 
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('fees');
            $table->dropColumn('is_collected_fees');
        });
    }
};